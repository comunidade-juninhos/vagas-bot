import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import readline from "readline";
import 'dotenv/config';
import { formatJobMessage } from '../utils/formatter.js';

const rl = readline.createInterface({ input: process.stdin, output: process.stdout});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let socketInstance = null;

export async function connectWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "error" }),
        printQRInTerminal: process.env.AUTH_METHOD === 'qr',
        auth: state,
        browser: ["Mac OS", "Chrome", "10.15.7"],
    });

    socketInstance = sock;

    if (process.env.AUTH_METHOD === 'code' && !sock.authState.creds.registered) {
        let phoneNumber = process.env.MOBILE_NUMBER;
        if (!phoneNumber) phoneNumber = await question('Enter your mobile number: ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, '');
        if (phoneNumber) {
            await delay(6000);
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔥 Pairing Code: ${code}\n`);
        }
    }

    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectWhatsApp();
        } else if (connection === "open") {
            console.log("✅ [WHATSAPP CONNECTED]");
        }
    });

    sock.ev.on("creds.update", saveCreds);
    return sock;
}

export async function sendJob(job, jid) {
    if (!socketInstance) return console.error("❌ Socket not initialized");
    try {
        const message = await formatJobMessage(job);
        await socketInstance.sendMessage(jid, { text: message });
        console.log(`✅ [SUCCESS] Sent to: ${jid}`);
    } catch (error) {
        console.error(`❌ [ERROR] Failed to send: ${error.message}`);
    }
}


