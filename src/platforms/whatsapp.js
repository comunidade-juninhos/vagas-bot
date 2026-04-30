import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
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
let isReady = false; // sinaliza se o bot está pronto para enviar mensagens
let lockHeartbeatInterval = null;
let reconnectInProgress = false;
let lastReadyAt = null;
let lastCloseAt = null;
let lastRepairAt = null;
let consecutiveSendFailures = 0;
const MAX_SEND_FAILURES_BEFORE_REPAIR = 5;
const REPAIR_COOLDOWN_MS = 15 * 60 * 1000;

const NOISY_BAILEYS_PATTERNS = [
    'transaction failed, rolling back',
    'no session found to decrypt message',
    'failed to decrypt message',
    'session record',
    'status@broadcast',
    'stream errored out',
    'closing open session in favor of incoming prekey bundle',
    'bad mac',
    'failed to process sender key distribution message',
    'failed to decode plaintext newsletter message',
    'invalid mex newsletter notification',
    'invalid newsletter notification',
    'failed to send retry after error handling',
    'error in handling message',
    'retrying pre-key upload',
    'uploading pre-keys',
    'failed to upload pre-keys',
];

function stringifyLogArg(arg) {
    if (typeof arg === 'string') return arg;
    if (arg instanceof Error) return String(arg);
    try {
        return JSON.stringify(arg);
    } catch {
        return String(arg);
    }
}

function isNoisyBaileysLog(...args) {
    const text = args.map(stringifyLogArg).join(' ').toLowerCase();
    return NOISY_BAILEYS_PATTERNS.some((pattern) => text.includes(pattern));
}

const baileysLogger = {
    level: 'error',
    trace: () => {},
    debug: () => {},
    info: () => {},
    warn: (...args) => {
        if (isNoisyBaileysLog(...args)) return;
        console.warn('[BAILEYS WARN]', ...args);
    },
    error: (...args) => {
        if (isNoisyBaileysLog(...args)) return;
        console.error('[BAILEYS ERROR]', ...args);
    },
    fatal: (...args) => {
        if (isNoisyBaileysLog(...args)) return;
        console.error('[BAILEYS FATAL]', ...args);
    },
    child: function () {
        return this;
    },
    isLevelEnabled: () => false,
};

function normalizeErrorMessage(error) {
    if (!error) return "";
    return String(error.message || error).toLowerCase();
}

async function forceRepairSession(reason) {
    const now = Date.now();
    if (lastRepairAt && (now - lastRepairAt) < REPAIR_COOLDOWN_MS) {
        console.log(`⚠️ [WHATSAPP] Reparo ignorado (cooldown ativo). Motivo: ${reason}`);
        return;
    }

    lastRepairAt = now;
    reconnectInProgress = false;
    isReady = false;
    consecutiveSendFailures = 0;
    currentPairingCode = "REPARANDO SESSAO...";

    console.log(`🚨 [WHATSAPP] Forçando reparo de sessão: ${reason}`);
    if (fs.existsSync('./auth_info')) fs.rmSync('./auth_info', { recursive: true, force: true });
    await SessionModel.deleteOne({ id: 'whatsapp_session' });
    await delay(3000);
    await connectWhatsApp();
}

export function getWhatsAppStatus() {
    return {
        isReady,
        hasSocket: Boolean(socketInstance),
        lastReadyAt,
        lastCloseAt,
        reconnectInProgress,
        consecutiveSendFailures
    };
}

// função para ligar o whatsapp via baileys
export async function connectWhatsApp() {
    isReady = false;
    // 0. TRAVA DE SEGURANÇA: garante que só uma instância do Render conecte por vez
    try {
        const now = new Date();
        const lock = await LockModel.findOne({ id: 'instance_lock' });
        
        // se houver um lock de menos de 45 segundos atrás de OUTRA instância, a gente espera
        if (lock && lock.instanceId !== myInstanceId && (now - lock.lastSeen) < 45000) {
            console.log("⏳ [SYSTEM] Outra instância está ativa. Aguardando 30s...");
            currentPairingCode = "AGUARDANDO OUTRO BOT...";
            await delay(30000);
            return connectWhatsApp();
        }

        await LockModel.findOneAndUpdate(
            { id: 'instance_lock' },
            { instanceId: myInstanceId, lastSeen: now },
            { upsert: true }
        );

        // atualiza o lock a cada 20 segundos para manter a posse
        if (!lockHeartbeatInterval) {
            lockHeartbeatInterval = setInterval(async () => {
                await LockModel.findOneAndUpdate(
                    { id: 'instance_lock' },
                    { lastSeen: new Date() }
                );
            }, 20000);
        }
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

    const sock = makeWASocket({
        version,
        logger: baileysLogger,
        printQRInTerminal: false,
        auth: state,
        browser: ["Ubuntu", "Chrome", "20.0.0.0"],
        connectTimeoutMs: 60000,
        defaultQueryTimeoutMs: 60000,
        keepAliveIntervalMs: 30000,
    });

    socketInstance = sock;

    // lógica para login via código
    if (process.env.AUTH_METHOD === 'code' && !sock.authState.creds.registered) {
        const phoneNumber = process.env.MOBILE_NUMBER?.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`🔌 [WHATSAPP] Solicitando código para ${phoneNumber}...`);
            currentPairingCode = "GERANDO...";
            try {
                await delay(10000); // espera extra para estabilizar
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
            isReady = false;
            reconnectInProgress = true;
            lastCloseAt = new Date().toISOString();
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
            
            // SE A SESSÃO BUGAR (ERRO 401 OU 428 PERSISTENTE), LIMPAMOS E PEDIMOS NOVO LOGIN
            if (statusCode === 401 || statusCode === 411) {
                console.log("🚨 [WHATSAPP] Sessão corrompida. Limpando para novo pareamento...");
                if (fs.existsSync('./auth_info')) fs.rmSync('./auth_info', { recursive: true, force: true });
                await SessionModel.deleteOne({ id: 'whatsapp_session' });
            }

            console.log(`🔌 [WHATSAPP] Conexão fechada (${statusCode}). Reconectando...`);
            if (shouldReconnect) {
                await delay(10000);
                await connectWhatsApp();
            }
        } else if (connection === "open") {
            isReady = true;
            reconnectInProgress = false;
            lastReadyAt = new Date().toISOString();
            consecutiveSendFailures = 0;
            currentQRCode = null;
            console.log("✅ [WHATSAPP CONNECTED AND READY]");
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
    if (!socketInstance) {
        console.error("❌ socket não inicializado");
        return false;
    }
    try {
        const message = await formatJobMessage(job);
        
        // verifica se o bot está 100% pronto (evita erro de 'attrs')
        if (isReady) {
            await socketInstance.sendMessage(jid, { text: message });
            consecutiveSendFailures = 0;
            console.log(`✅ [success] enviada para: ${jid}`);
            return true;
        } else {
            console.log("⏳ [WHATSAPP] Bot ainda não está pronto. Mensagem ignorada (será enviada no próximo loop)");
            return false;
        }
    } catch (error) {
        const errorMessage = normalizeErrorMessage(error);
        consecutiveSendFailures += 1;
        console.error(`❌ [error] falha ao enviar: ${error.message}`);

        const shouldRepairByError =
            errorMessage.includes('bad mac') ||
            errorMessage.includes('prekey') ||
            errorMessage.includes('no session found') ||
            errorMessage.includes('no matching sessions');

        const shouldRepairByVolume = consecutiveSendFailures >= MAX_SEND_FAILURES_BEFORE_REPAIR;

        if (shouldRepairByError || shouldRepairByVolume) {
            await forceRepairSession(shouldRepairByError ? error.message : "muitas falhas consecutivas de envio");
        }

        return false;
    }
}




