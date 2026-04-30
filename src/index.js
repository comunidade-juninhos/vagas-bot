import express from 'express';
import { connectWhatsApp, sendJob, currentPairingCode, currentQRCode, getWhatsAppStatus } from './platforms/whatsapp.js';
import { connectDiscord, sendJobDiscord } from './platforms/discord.js';
import { config } from './config/index.js';
import { connectDB } from './config/database.js';
import { createVaga, updateVagaStatus } from './services/vagaService.js';
import { cleanupOldJobs } from './repository/vagaRepository.js';

import { runScrapersAndNotify } from './services/scraper.js';
import mongoose from 'mongoose';


const app = express();
app.use(express.json()); // permite que o servidor entenda json no corpo das requisições

const BUSINESS_START_HOUR = 5;   // 05:00
const BUSINESS_END_HOUR = 24;    // 00:00 (fim do dia)
const SCHEDULE_INTERVAL_HOURS = 2;
const SCHEDULE_TIMEZONE = process.env.SCHEDULE_TIMEZONE || 'America/Sao_Paulo';
let isCycleRunning = false;
let lastExecutedSlotKey = null;

function getNowInScheduleTimezone() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: SCHEDULE_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    }).formatToParts(now);

    const map = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second)
    };
}

function shouldRunCommercialCycle(nowParts) {
    const { hour, minute } = nowParts;
    if (minute !== 0) return false;
    if (hour < BUSINESS_START_HOUR || hour >= BUSINESS_END_HOUR) return false;
    return (hour - BUSINESS_START_HOUR) % SCHEDULE_INTERVAL_HOURS === 0;
}

async function runScheduledCycle(reason) {
    if (isCycleRunning) {
        console.log(`⏳ [scheduler] ciclo ignorado (${reason}) porque outro ciclo ainda está em execução.`);
        return;
    }

    isCycleRunning = true;
    const wa = getWhatsAppStatus();
    const cycleStartedAt = new Date().toISOString();
    console.log(`▶️ [cycle] start=${cycleStartedAt} motivo=${reason} waReady=${wa.isReady} reconnecting=${wa.reconnectInProgress} failSeq=${wa.consecutiveSendFailures}`);

    try {
        const result = await runScrapersAndNotify();
        const waAfter = getWhatsAppStatus();
        console.log(`✅ [cycle] fim motivo=${reason} encontradas=${result?.foundJobs ?? 0} enviadas=${result?.sentJobs ?? 0} falhas=${result?.notifyErrors ?? 0} duracaoMs=${result?.durationMs ?? 0} waReady=${waAfter.isReady}`);
    } catch (error) {
        console.error(`❌ [cycle] erro no ciclo (${reason}):`, error.message);
    } finally {
        isCycleRunning = false;
    }
}

// função principal que liga todo o sistema
async function startSystem() {
    console.log("🚀 [SYSTEM] Iniciando Servidor...");

    // 1. conecta ao banco de dados (fundamental para não repetir vagas)
    await connectDB();

    // 2. liga as conexões com o whatsapp e discord
    await connectWhatsApp();
    const discordClient = await connectDiscord();

    // rota de "estou vivo" para o render não desligar o servidor
    app.get('/ping', (req, res) => res.send('pong'));

    // rota: mostra o código de pareamento e o qr code do whatsapp
    app.get('/codigo', (req, res) => {
        const color = (currentPairingCode.length === 8) ? "#25D366" : "#ff4444";
        const qrHtml = currentQRCode ? `
            <div style="margin-top: 20px;">
                <p><b>OU ESCANEIE O QR CODE:</b></p>
                <img src="${currentQRCode}" style="border: 10px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 10px;" />
            </div>
        ` : '';

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 30px; background: #f4f7f6; min-height: 100vh;">
                <div style="background: white; display: inline-block; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 500px;">
                    <h1 style="color: #075E54;">🔥 Conexão WhatsApp</h1>
                    
                    <div style="background: #e7f3ef; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
                        <p style="margin: 0; color: #075E54;"><b>OPÇÃO 1: CÓDIGO</b></p>
                        <div style="font-size: 50px; font-weight: bold; color: ${color}; letter-spacing: 8px; margin: 15px 0;">
                            ${currentPairingCode}
                        </div>
                    </div>

                    ${qrHtml}

                    <p style="font-size: 16px; color: #555; margin-top: 20px;">
                        No seu celular, vá em:<br> 
                        <b>Aparelhos Conectados > Conectar um aparelho</b>
                    </p>
                    <hr style="margin: 25px 0; border: 0; border-top: 1px solid #eee;">
                    <a href="/reset" style="text-decoration: none; background: #ff4444; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold; font-size: 14px;">RESETAR TENTATIVA</a>
                </div>
                <script>
                    // recarrega a página a cada 10 segundos para atualizar o QR/Código
                    setTimeout(() => location.reload(), 10000);
                </script>
            </div>
        `);
    });


    // rota para resetar a conexão do whatsapp
    app.get('/reset', async (req, res) => {
        console.log("♻️ [SYSTEM] Solicitando reset de conexão...");
        await connectWhatsApp();
        res.send("🔄 Tentando gerar novo código... <a href='/codigo'>Voltar para a página do código</a>");
    });


    // rota para ligar a busca de vagas manualmente pelo navegador
    app.get('/run-scraper', async (req, res) => {
        runScheduledCycle('manual');
        res.send("🚀 Scraper iniciado com sucesso!");
    });

    // rota para limpar o banco de dados (usar apenas para teste)
    app.get('/limpar-banco', async (req, res) => {
        try {
            const Vaga = mongoose.model('Vaga');
            await Vaga.deleteMany({});
            console.log("🧹 [DATABASE] Banco de dados de vagas limpo com sucesso!");
            res.send("🧹 Banco de dados limpo! O bot vai reenviar tudo na próxima varredura.");
        } catch (err) {
            res.status(500).send("Erro ao limpar banco: " + err.message);
        }
    });

    // rota de webhook onde o scraper envia as vagas novas encontradas
    app.post('/webhook/nova-vaga', async (req, res) => {
        const jobData = req.body;
        console.log(`📩 Recebido: ${jobData.title}`);

        try {
            // tenta salvar ou recuperar a vaga existente
            const result = await createVaga(jobData);
            const vaga = result.vaga; // a vaga que está no banco

            if (!result.created) {
                // se a vaga já existia, mas já foi enviada para os dois canais, ignora
                if (vaga.sent_whatsapp && vaga.sent_discord) {
                    console.log(`⏭️ [SKIP] Vaga já processada completamente: ${jobData.title}`);
                    return res.status(200).send("Already processed");
                }
                console.log(`⏳ [RETRY] Vaga pendente de envio detectada: ${jobData.title}`);
            } else {
                console.log(`🆕 [NEW] Vaga inédita detectada!`);
            }

            // 1. tenta enviar para o whatsapp se ainda não foi
            if (!vaga.sent_whatsapp) {
                const success = await sendJob(jobData, config.whatsapp.groupId);
                if (success) {
                    await updateVagaStatus(vaga._id, { sent_whatsapp: true });
                }
            }

            // 2. tenta enviar para o discord se ainda não foi
            if (!vaga.sent_discord && discordClient && config.discord.channelId) {
                const success = await sendJobDiscord(discordClient, jobData, config.discord.channelId);
                if (success) {
                    await updateVagaStatus(vaga._id, { sent_discord: true });
                }
            }

            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ [WEBHOOK] Erro ao processar vaga:", err.message);
            res.status(500).send("Error");
        }
    });

    // liga o servidor na porta configurada (geralmente 3000)
    app.listen(config.port, () => {
        console.log(`📡 server listening on port ${config.port}`);
        
        const UM_DIA = 24 * 60 * 60 * 1000;
        console.log(`⏰ [system] scheduler comercial ativado (${BUSINESS_START_HOUR}:00-${BUSINESS_END_HOUR}:00, a cada ${SCHEDULE_INTERVAL_HOURS}h, tz=${SCHEDULE_TIMEZONE})`);
        
        // espera 1 minuto para estabilizar conexões antes de começar a agenda
        setTimeout(() => {
            console.log("🕐 [scheduler] monitor iniciado (checagem a cada minuto)");
            setInterval(() => {
                const now = getNowInScheduleTimezone();
                const slotKey = `${now.year}-${String(now.month).padStart(2, '0')}-${String(now.day).padStart(2, '0')} ${String(now.hour).padStart(2, '0')}:00`;

                if (!shouldRunCommercialCycle(now)) return;
                if (lastExecutedSlotKey === slotKey) return;

                lastExecutedSlotKey = slotKey;
                runScheduledCycle(`slot-${slotKey}`);
            }, 60 * 1000);

            // limpeza do banco uma vez por dia (remove vagas com mais de 1 mês)
            setInterval(() => {
                cleanupOldJobs();
            }, UM_DIA);
        }, 60000); // 1 minuto de delay
    });
}

startSystem();





