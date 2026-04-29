import express from 'express';
import { connectWhatsApp, sendJob, currentPairingCode, currentQRCode } from './platforms/whatsapp.js';
import { connectDiscord, sendJobDiscord } from './platforms/discord.js';
import { config } from './config/index.js';
import { connectDB } from './config/database.js';
import { createVaga } from './services/vagaService.js';
import { runScrapersAndNotify } from './services/scraper.js';

const app = express();
app.use(express.json()); // permite que o servidor entenda json no corpo das requisições

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

    // ROTA NOVA: mostra o código de pareamento e o QR Code do whatsapp
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


    // ROTA PARA RESETAR O WHATSAPP
    app.get('/reset', async (req, res) => {
        console.log("♻️ [SYSTEM] Solicitando reset de conexão...");
        await connectWhatsApp();
        res.send("🔄 Tentando gerar novo código... <a href='/codigo'>Voltar para a página do código</a>");
    });


    // rota para ligar a busca de vagas manualmente pelo navegador
    app.get('/run-scraper', async (req, res) => {
        runScrapersAndNotify(); // dispara a busca em segundo plano
        res.send("🚀 Scraper iniciado com sucesso!");
    });

    // rota de webhook onde o scraper envia as vagas novas encontradas
    app.post('/webhook/nova-vaga', async (req, res) => {
        const jobData = req.body;
        console.log(`📩 Recebido: ${jobData.title}`);

        try {
            // tenta salvar no banco (o service já faz a deduplicação via hash/url)
            const result = await createVaga(jobData);

            // se a vaga já existia no banco, o 'result.created' será false
            if (!result.created) {
                console.log(`⏭️ [SKIP] Vaga já enviada anteriormente: ${jobData.title}`);
                return res.status(200).send("Already exists");
            }

            console.log(`🆕 [NEW] Vaga inédita detectada! Enviando para as redes...`);

            // tenta enviar a vaga para o grupo de whatsapp
            await sendJob(jobData, config.whatsapp.groupId);

            // se o discord estiver logado, envia para o canal configurado
            if (discordClient && config.discord.channelId) {
                await sendJobDiscord(discordClient, jobData, config.discord.channelId);
            }
            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ [WEBHOOK] Error processing job:", err.message);
            res.status(500).send("Error");
        }
    });

    // liga o servidor na porta configurada (geralmente 3000)
    app.listen(config.port, () => {
        console.log(`📡 server listening on port ${config.port}`);
        
        // inicia o loop automático de busca de vagas (a cada 15 minutos)
        const QUINZE_MINUTOS = 15 * 60 * 1000;
        console.log("⏰ [SYSTEM] Loop de busca automática ativado (15m)");
        
        // espera 1 minuto antes de começar a busca automática
        // isso é CRÍTICO no render para o bot velho desligar e o novo gerar o código certo
        setTimeout(() => {
            console.log("⏰ [SYSTEM] Iniciando primeira busca de vagas...");
            runScrapersAndNotify();
            
            // e depois repete a cada 15 minutos
            setInterval(() => {
                runScrapersAndNotify();
            }, QUINZE_MINUTOS);
        }, 60000); // 1 minuto de delay
    });
}

startSystem();





