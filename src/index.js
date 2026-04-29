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
        const color = currentPairingCode.length === 8 ? "#25D366" : "#ff4444";
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px; background: #f4f7f6; min-height: 100vh;">
                <div style="background: white; display: inline-block; padding: 40px; border-radius: 20px; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
                    <h1 style="color: #075E54;">🔥 Conexão WhatsApp</h1>
                    <div style="font-size: 60px; font-weight: bold; color: ${color}; letter-spacing: 8px; margin: 30px 0; border: 2px dashed ${color}; padding: 20px; border-radius: 10px;">
                        ${currentPairingCode}
                    </div>
                    <p style="font-size: 18px; color: #555;">Digite este código no seu WhatsApp em:<br> 
                    <b style="color: #000;">Aparelhos Conectados > Conectar com número de telefone</b></p>
                    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;">
                    <p style="color: #888;">Se o código for "Aguardando", espere alguns segundos ou clique em reset:</p>
                    <a href="/reset" style="text-decoration: none; background: #ff4444; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold;">FORÇAR RESET / NOVO CÓDIGO</a>
                </div>
                <script>
                    // recarrega a página a cada 5 segundos se estiver aguardando ou gerando
                    if (document.body.innerText.includes('Aguardando') || document.body.innerText.includes('GERANDO')) {
                        setTimeout(() => location.reload(), 5000);
                    }
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





