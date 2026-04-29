import express from 'express';
import { connectWhatsApp, sendJob, currentPairingCode } from './platforms/whatsapp.js';
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

    // ROTA NOVA: mostra o código de pareamento do whatsapp
    app.get('/codigo', (req, res) => {
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1>🔥 Código de Pareamento WhatsApp</h1>
                <div style="font-size: 48px; font-weight: bold; color: #25D366; letter-spacing: 5px; margin: 20px;">
                    ${currentPairingCode}
                </div>
                <p>Digite este código no seu WhatsApp em: <b>Aparelhos Conectados > Conectar com número de telefone</b></p>
                <p><i>Se o código não funcionar, atualize a página em alguns segundos.</i></p>
                <script>setTimeout(() => location.reload(), 10000);</script>
            </div>
        `);
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
        
        // inicia o loop automático de busca de vagas (a cada 1 hora)
        const UMA_HORA = 60 * 60 * 1000;
        console.log("⏰ [SYSTEM] Loop de busca automática ativado (1h)");
        
        // roda uma vez agora no início
        runScrapersAndNotify();
        
        // e depois repete a cada hora
        setInterval(() => {
            runScrapersAndNotify();
        }, UMA_HORA);
    });
}

startSystem();





