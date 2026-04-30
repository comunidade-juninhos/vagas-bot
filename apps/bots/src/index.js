import express from "express";
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

const app = express();
app.use(express.json({ limit: "1mb" }));

function renderWhatsAppPairingPage() {
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

async function start() {
  console.log("🚀 [bots] iniciando serviço de bots...");

  await connectDatabase();
  if (config.whatsapp.enabled) {
    await connectWhatsApp();
  } else {
    console.log("⏸️ [whatsapp] desativado por WHATSAPP_ENABLED=false");
  }

  const discordClient = config.discord.enabled ? await connectDiscord() : null;

  app.get("/health", (req, res) => {
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

  app.get("/ping", (req, res) => res.send("pong"));
  app.get("/codigo", (req, res) => res.redirect("/whatsapp/pairing"));
  app.get("/whatsapp/pairing", (req, res) => res.send(renderWhatsAppPairingPage()));

  app.get("/whatsapp/reset", async (req, res) => {
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
  });
}

start().catch((error) => {
  console.error("❌ [bots] falha ao iniciar:", error);
  process.exit(1);
});
