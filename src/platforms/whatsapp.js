import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import readline from "readline";
import fs from "fs";
import 'dotenv/config';
import { formatJobMessage } from '../utils/formatter.js';
import mongoose from 'mongoose';

// esquema simples para salvar a sessão no banco
const SessionSchema = new mongoose.Schema({
    id: { type: String, unique: true },
    data: String // guardamos o json das credenciais aqui
});
const SessionModel = mongoose.models.Session || mongoose.model('Session', SessionSchema);

// esquema para trava de instância (evita dois bots ao mesmo tempo)
const LockSchema = new mongoose.Schema({
    id: { type: String, default: 'instance_lock' },
    instanceId: String,
    lastSeen: Date
});
const LockModel = mongoose.models.Lock || mongoose.model('Lock', LockSchema);

const myInstanceId = Math.random().toString(36).substring(7);
export let currentPairingCode = "Aguardando..."; 
export let currentQRCode = null; // guarda o link do qr code

const rl = readline.createInterface({ input: process.stdin, output: process.stdout});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let socketInstance = null; // guarda a conexão ativa do whatsapp

// função para ligar o whatsapp via baileys
export async function connectWhatsApp() {
    // 0. TRAVA DE SEGURANÇA: garante que só uma instância do Render conecte por vez
    try {
        const now = new Date();
        const lock = await LockModel.findOne({ id: 'instance_lock' });
        
        // se houver um lock de menos de 45 segundos atrás de OUTRA instância, a gente espera
        if (lock && lock.instanceId !== myInstanceId && (now - lock.lastSeen) < 45000) {
            console.log("⏳ [SYSTEM] Outra instância está ativa. Aguardando 30s para não bugar o WhatsApp...");
            currentPairingCode = "AGUARDANDO OUTRO BOT...";
            await delay(30000);
            return connectWhatsApp();
        }

        // atualiza o lock a cada 20 segundos
        await LockModel.findOneAndUpdate(
            { id: 'instance_lock' },
            { instanceId: myInstanceId, lastSeen: now },
            { upsert: true }
        );
        setInterval(async () => {
            await LockModel.findOneAndUpdate(
                { id: 'instance_lock' },
                { lastSeen: new Date() }
            );
        }, 20000);
    } catch (e) {
        console.error("⚠️ [LOCK] Falha ao gerenciar trava de instância:", e.message);
    }

    // 1. tenta restaurar a sessão do banco de dados
    if (!fs.existsSync('./auth_info/creds.json')) {
        try {
            const savedSession = await SessionModel.findOne({ id: 'whatsapp_session' });
            if (savedSession) {
                console.log("📂 [WHATSAPP] Restaurando sessão do Banco de Dados...");
                if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
                fs.writeFileSync('./auth_info/creds.json', savedSession.data);
            }
        } catch (err) {
            console.error("⚠️ [WHATSAPP] Falha ao restaurar sessão:", err.message);
        }
    }

    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // configurações de rede ultra-resistentes
    const sock = makeWASocket({
        version,
        logger: pino({ level: "error" }),
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
        retryRequestDelayMs: 5000,
        generateHighQualityLinkPreview: true
    });

    socketInstance = sock;

    // lógica para login via código
    if (process.env.AUTH_METHOD === 'code' && !sock.authState.creds.registered) {
        const phoneNumber = process.env.MOBILE_NUMBER?.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`🔌 [WHATSAPP] Solicitando código para ${phoneNumber}...`);
            currentPairingCode = "GERANDO...";
            try {
                // espera o socket estar realmente pronto
                await delay(5000);
                const code = await sock.requestPairingCode(phoneNumber);
                currentPairingCode = code;
                console.log(`\n🔥 Pairing Code: ${code}\n`);
            } catch (err) {
                console.error("❌ [WHATSAPP] Erro ao pedir código:", err.message);
                currentPairingCode = "ERRO - TENTE RESET";
            }
        }
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) {
            currentQRCode = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(qr)}&chs=300x300`;
            currentPairingCode = "USE O QR CODE ABAIXO";
        }
        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            console.log(`🔌 [WHATSAPP] Conexão fechada (${statusCode}). Reconectando: ${shouldReconnect}`);
            if (shouldReconnect) {
                // evita loops infinitos imediatos
                await delay(5000);
                connectWhatsApp();
            }
        } else if (connection === "open") {
            currentQRCode = null;
            console.log("✅ [WHATSAPP CONNECTED]");
        }
    });


    // salva as credenciais localmente E no banco de dados para backup
    sock.ev.on("creds.update", async () => {
        await saveCreds(); // salva no arquivo local
        try {
            // faz o backup do creds.json para o mongodb
            const credsData = fs.readFileSync('./auth_info/creds.json', 'utf-8');
            await SessionModel.findOneAndUpdate(
                { id: 'whatsapp_session' },
                { data: credsData },
                { upsert: true }
            );
        } catch (err) {
            console.error("⚠️ [WHATSAPP] Erro ao salvar backup da sessão:", err.message);
        }
    });

    return sock;
}

// função que envia a mensagem formatada
export async function sendJob(job, jid) {
    if (!socketInstance) return console.error("❌ socket não inicializado");
    try {
        const message = await formatJobMessage(job);
        
        // verifica se o socket está aberto antes de tentar enviar (evita erro de 'attrs')
        if (socketInstance.ws?.readyState === 1) {
            await socketInstance.sendMessage(jid, { text: message });
            console.log(`✅ [success] enviada para: ${jid}`);
        } else {
            console.log("⏳ [WHATSAPP] Socket fechado. Mensagem ignorada (será enviada no próximo loop)");
        }
    } catch (error) {
        console.error(`❌ [error] falha ao enviar: ${error.message}`);
    }
}




