import express from 'express';
import { connectWhatsApp, sendJob } from './platforms/whatsapp.js';
import { connectDiscord, sendJobDiscord } from './platforms/discord.js';
import { config } from './config/index.js';
import { runScrapersAndNotify } from './services/scraper.js';

const app = express();
app.use(express.json()); // permite que o servidor entenda json no corpo das requisições

// função principal que liga todo o sistema
async function startSystem() {
    console.log("🚀 [SYSTEM] Starting Server...");

    // liga as conexões com o whatsapp e discord
    await connectWhatsApp();
    const discordClient = await connectDiscord();
    
    // rota de "estou vivo" para o render não desligar o servidor
    app.get('/ping', (req, res) => res.send('pong'));

    // rota para ligar a busca de vagas manualmente pelo navegador
    app.get('/run-scraper', async (req, res) => {
        runScrapersAndNotify(); // dispara a busca em segundo plano
        res.send("scraper iniciado!");
    });

    // rota de webhook onde o scraper envia as vagas novas encontradas
    app.post('/webhook/nova-vaga', async (req, res) => {
        const job = req.body;
        console.log(`📩 Received: ${job.title}`);

        try {
            // tenta enviar a vaga para o grupo de whatsapp
            await sendJob(job, config.whatsapp.groupId);
            
            // se o discord estiver logado, envia para o canal configurado
            if (discordClient && config.discord.channelId) {
                await sendJobDiscord(discordClient, job, config.discord.channelId);
            }
            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ [WEBHOOK] Error processing job:", err.message);
            res.status(500).send("Error");
        }
    });

    // liga o servidor na porta configurada (geralmente 3000)
    app.listen(config.port, () => console.log(`📡 server listening on port ${config.port}`));
}

startSystem();




