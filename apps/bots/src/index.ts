import express from "express";
import type { Request, Response } from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import "dotenv/config";
import {
  connectWhatsApp,
  currentPairingCode,
  currentQRCode,
  getWhatsAppStatus
} from "./platforms/whatsapp.js";
import { connectDiscord } from "./platforms/discord.js";
import { config } from "./config/index.js";
import { connectDatabase } from "#root/services/database.js";
import { createJobsWebhookRouter } from "./webhooks/jobs.js";
import { startScheduler } from "./bots/scheduler.js";

const app = express();

// Confia no proxy reverso (Render, Hugging Face, etc.) para obter o IP real
app.set("trust proxy", 1);

// Segurança Básica
app.use(helmet({
  contentSecurityPolicy: false, // Necessário se for rodar HTML inline com CSS/Scripts
  frameguard: false             // Permite que plataformas como Hugging Face exibam a UI em iframe
}));
app.disable("x-powered-by");

// Limita as requisições para evitar DDoS/Brute force
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 150, // limite por IP
  standardHeaders: "draft-7",
  legacyHeaders: false,
  skip: (req) => req.path === "/health" || req.path === "/ping",
});
app.use(limiter);

app.use(express.json({ limit: "1mb" }));

function renderWhatsAppPairingPage(): string {
  if (!config.whatsapp.enabled) {
    return `
      <div style="font-family: sans-serif; text-align: center; padding: 30px; background: #f4f7f6; min-height: 100vh;">
        <div style="background: white; display: inline-block; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 500px;">
          <h1 style="color: #075E54;">WhatsApp desativado</h1>
          <p style="font-size: 16px; color: #555;">Defina <b>WHATSAPP_ENABLED=true</b> para habilitar pareamento e envio.</p>
        </div>
      </div>
    `;
  }

  const color = currentPairingCode.length === 8 ? "#25D366" : "#ff4444";
  const qrHtml = currentQRCode
    ? `
      <div style="margin-top: 20px;">
        <p><b>OU ESCANEIE O QR CODE:</b></p>
        <img src="${currentQRCode}" style="border: 10px solid white; box-shadow: 0 5px 15px rgba(0,0,0,0.2); border-radius: 10px;" />
      </div>
    `
    : "";

  return `
    <div style="font-family: sans-serif; text-align: center; padding: 30px; background: #f4f7f6; min-height: 100vh;">
      <div style="background: white; display: inline-block; padding: 40px; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.1); max-width: 500px;">
        <h1 style="color: #075E54;">Conexão WhatsApp</h1>
        <div style="background: #e7f3ef; padding: 20px; border-radius: 10px; margin-bottom: 20px;">
          <p style="margin: 0; color: #075E54;"><b>CÓDIGO DE PAREAMENTO</b></p>
          <div style="font-size: 50px; font-weight: bold; color: ${color}; letter-spacing: 8px; margin: 15px 0;">
            ${currentPairingCode}
          </div>
        </div>
        ${qrHtml}
        <p style="font-size: 16px; color: #555; margin-top: 20px;">
          No celular: <b>Aparelhos conectados > Conectar um aparelho</b>
        </p>
        <hr style="margin: 25px 0; border: 0; border-top: 1px solid #eee;">
        <a href="/whatsapp/reset" style="text-decoration: none; background: #ff4444; color: white; padding: 10px 20px; border-radius: 5px; font-weight: bold; font-size: 14px;">RESETAR TENTATIVA</a>
      </div>
      <script>setTimeout(() => location.reload(), 10000);</script>
    </div>
  `;
}

async function startKeepAlive() {
  const url = process.env.RENDER_EXTERNAL_URL || process.env.PUBLIC_URL;
  if (!url) {
    console.log("ℹ️ [keep-alive] RENDER_EXTERNAL_URL não definida. Ignorando auto-ping.");
    return;
  }

  console.log(`⏱️ [keep-alive] monitorando: ${url}/ping (a cada 10 min)`);
  
  setInterval(async () => {
    try {
      const res = await fetch(`${url}/ping`);
      if (res.ok) {
        console.log(`💓 [keep-alive] self-ping OK (${new Date().toLocaleTimeString()})`);
      }
    } catch (err) {
      console.error("⚠️ [keep-alive] erro no self-ping:", err instanceof Error ? err.message : err);
    }
  }, 10 * 60 * 1000); // 10 minutos
}

async function start() {
  console.log("🚀 [bots] iniciando serviço de bots...");

  await connectDatabase();
  if (config.whatsapp.enabled) {
    connectWhatsApp().catch(err => console.error("❌ [whatsapp] erro na conexão assíncrona:", err));
  } else {
    console.log("⏸️ [whatsapp] desativado por WHATSAPP_ENABLED=false");
  }

  const discordClient = config.discord.enabled ? await connectDiscord() : null;

  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: "vagas-bot/bots",
      channels: {
        discord: config.discord.enabled,
        whatsapp: config.whatsapp.enabled
      },
      whatsapp: getWhatsAppStatus()
    });
  });

  app.get("/ping", (_req: Request, res: Response) => res.send("pong"));
  app.get("/codigo", (_req: Request, res: Response) => res.redirect("/whatsapp/pairing"));
  app.get("/whatsapp/pairing", (_req: Request, res: Response) => res.send(renderWhatsAppPairingPage()));
  
  // Rota temporária para testar o resumo diário
  app.get("/test/digest", async (_req: Request, res: Response) => {
    if (discordClient) {
      const { sendBatchDigest } = await import("./bots/scheduler.js");
      await sendBatchDigest(discordClient, 5);
      return res.send("✅ Comandado envio do lote de teste (5 vagas)!");
    }
    res.status(400).send("❌ Discord não conectado.");
  });

  // Rota experimental: Só Estágio e Junior para um grupo de teste
  app.get("/experimental/force", async (_req: Request, res: Response) => {
    const testGroupId = process.env.TEST_WHATSAPP_GROUP_ID;
    if (!testGroupId) {
        return res.status(400).send("❌ TEST_WHATSAPP_GROUP_ID não configurado no .env");
    }

    try {
        const { forceExperimentalScrape } = await import("../../experimental/test-bot.js");
        await forceExperimentalScrape(testGroupId, discordClient);
        return res.send("🧪 Teste de Estágio/Junior disparado! Confira o WhatsApp e o Discord de teste.");
    } catch (error) {
        console.error(error);
        res.status(500).send("❌ Erro ao disparar teste experimental.");
    }
  });

  // Limpa a trava de instância para testes locais
  app.get("/experimental/clear-lock", async (_req: Request, res: Response) => {
    try {
        const mongoose = await import('mongoose');
        const Lock = mongoose.default.models.Lock || mongoose.default.model('Lock', new mongoose.default.Schema({ id: String }));
        await Lock.deleteOne({ id: 'instance_lock' });
        return res.send("✅ Trava de instância removida! Tente reiniciar o bot.");
    } catch (error) {
        res.status(500).send("❌ Erro ao remover trava.");
    }
  });

  app.get("/whatsapp/reset", async (_req: Request, res: Response) => {
    if (!config.whatsapp.enabled) {
      return res.status(409).send("WhatsApp desativado. Defina WHATSAPP_ENABLED=true para parear.");
    }

    console.log("♻️ [whatsapp] reset solicitado pela interface de pareamento");
    await connectWhatsApp();
    res.redirect("/whatsapp/pairing");
  });

  app.use("/webhooks/jobs", createJobsWebhookRouter({ discordClient }));

  app.listen(config.port, () => {
    console.log(`📡 [bots] ouvindo na porta ${config.port}`);
    startKeepAlive();
    
    // Inicia o agendador de qualquer forma (ele lida internamente se tem discord ou nao)
    startScheduler(discordClient);

    // Inicia o ambiente de teste local, se existir
    import('./teste-local/test-scheduler.js')
      .then((mod) => mod.startTestScheduler(discordClient))
      .catch(() => { /* ignora se o arquivo nao existir (ex: producao) */ });
  });
}

start().catch((error) => {
  console.error("❌ [bots] falha ao iniciar:", error);
  process.exit(1);
});
