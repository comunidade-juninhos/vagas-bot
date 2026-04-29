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

export let currentPairingCode = "Aguardando..."; // variável global para guardar o código
export let currentQRCode = null; // guarda o link do qr code

const rl = readline.createInterface({ input: process.stdin, output: process.stdout});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let socketInstance = null; // guarda a conexão ativa do whatsapp

// função para ligar o whatsapp via baileys
export async function connectWhatsApp() {
    // 1. tenta restaurar a sessão do banco de dados se a pasta local sumiu (comum no render)
    if (!fs.existsSync('./auth_info/creds.json')) {
        try {
            const savedSession = await SessionModel.findOne({ id: 'whatsapp_session' });
            if (savedSession) {
                console.log("📂 [WHATSAPP] Restaurando sessão do Banco de Dados...");
                if (!fs.existsSync('./auth_info')) fs.mkdirSync('./auth_info');
                fs.writeFileSync('./auth_info/creds.json', savedSession.data);
            }
        } catch (err) {
            console.error("⚠️ [WHATSAPP] Falha ao restaurar sessão do banco:", err.message);
        }
    }

    // carrega as credenciais da pasta auth_info
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // configura o socket do whatsapp
    const sock = makeWASocket({
        version,
        logger: pino({ level: "error" }),
        printQRInTerminal: process.env.AUTH_METHOD === 'qr',
        auth: state,
        // usando Ubuntu/Chrome para maior estabilidade no pareamento
        browser: ["Ubuntu", "Chrome", "20.0.0.0"],
    });

    socketInstance = sock;

    // lógica para login via código de pareamento
    if (process.env.AUTH_METHOD === 'code' && !sock.authState.creds.registered) {
        let phoneNumber = process.env.MOBILE_NUMBER;
        if (!phoneNumber) {
            currentPairingCode = "FALTA NÚMERO NO .ENV";
            console.log("⚠️ [WHATSAPP] Erro: MOBILE_NUMBER não configurado no Render!");
            return sock;
        }

        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            console.log(`🔌 [WHATSAPP] Solicitando código para ${phoneNumber}...`);
            currentPairingCode = "GERANDO...";
            
            try {
                const code = await sock.requestPairingCode(phoneNumber);
                currentPairingCode = code; // salva o código para a página web
                console.log(`\n🔥 Pairing Code: ${code}\n`);
            } catch (err) {
                console.error("❌ [WHATSAPP] Erro ao pedir código:", err.message);
                currentPairingCode = "ERRO AO GERAR";
            }
        }
    }


    // monitora o estado da conexão
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect, qr } = update;

        // se o whatsapp mandar um QR code, a gente salva ele
        if (qr) {
            currentQRCode = `https://chart.googleapis.com/chart?cht=qr&chl=${encodeURIComponent(qr)}&chs=300x300`;
            currentPairingCode = "USE O QR CODE ABAIXO";
        }

        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectWhatsApp();
        } else if (connection === "open") {
            currentQRCode = null; // limpa o QR após conectar
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
        await socketInstance.sendMessage(jid, { text: message });
        console.log(`✅ [success] enviada para: ${jid}`);
    } catch (error) {
        console.error(`❌ [error] falha ao enviar: ${error.message}`);
    }
}




