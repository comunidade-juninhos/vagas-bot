import express from 'express';
import { connectWhatsApp, sendJob } from './platforms/whatsapp.js';
import { connectDiscord, sendJobDiscord } from './platforms/discord.js';

const app = express();
app.use(express.json());

const WHATSAPP_GROUP_ID = '120363406857942739@g.us';
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

async function startSystem() {
    console.log("🚀 [SYSTEM] Starting Server...");

    // Initialize connections
    await connectWhatsApp();
    const discordClient = await connectDiscord();
    
    // Rota de Keep-Alive para o Render não dormir
    app.get('/ping', (req, res) => res.send('pong'));


    app.post('/webhook/nova-vaga', async (req, res) => {
        const job = req.body;
        console.log(`📩 Received: ${job.title}`);

        try {
            await sendJob(job, WHATSAPP_GROUP_ID);
            
            if (discordClient && DISCORD_CHANNEL_ID) {
                await sendJobDiscord(discordClient, job, DISCORD_CHANNEL_ID);
            }
            res.status(200).send("OK");
        } catch (err) {
            console.error("❌ [WEBHOOK] Error processing job:", err.message);
            res.status(500).send("Error");
        }
    });

    app.listen(3000, () => console.log("📡 Webhook listening on port 3000"));
}

startSystem();


