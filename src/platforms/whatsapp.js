import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion, delay } from "@whiskeysockets/baileys";
import pino from "pino";
import readline from "readline";
import 'dotenv/config';
import { formatJobMessage } from '../utils/formatter.js';

// interface para ler entrada do teclado (usada para pegar o número de telefone se faltar)
const rl = readline.createInterface({ input: process.stdin, output: process.stdout});
const question = (text) => new Promise((resolve) => rl.question(text, resolve));

let socketInstance = null; // guarda a conexão ativa do whatsapp

// função para ligar o whatsapp via baileys
export async function connectWhatsApp() {
    // carrega as credenciais da pasta auth_info (onde fica salva a sessão)
    const { state, saveCreds } = await useMultiFileAuthState('auth_info');
    const { version } = await fetchLatestBaileysVersion();

    // configura o socket do whatsapp
    const sock = makeWASocket({
        version,
        logger: pino({ level: "error" }), // log apenas de erro para não poluir o terminal
        printQRInTerminal: process.env.AUTH_METHOD === 'qr', // mostra qr code se configurado
        auth: state,
        browser: ["Mac OS", "Chrome", "10.15.7"], // identifica o bot como um navegador chrome
    });

    socketInstance = sock;

    // lógica para login via código de pareamento (pairing code)
    if (process.env.AUTH_METHOD === 'code' && !sock.authState.creds.registered) {
        let phoneNumber = process.env.MOBILE_NUMBER;
        if (!phoneNumber) phoneNumber = await question('Enter your mobile number: ');
        phoneNumber = phoneNumber.replace(/[^0-9]/g, ''); // limpa tudo que não for número
        if (phoneNumber) {
            await delay(6000); // espera o socket estabilizar
            const code = await sock.requestPairingCode(phoneNumber);
            console.log(`\n🔥 Pairing Code: ${code}\n`);
        }
    }

    // monitora o estado da conexão (aberto, fechado, reconectando)
    sock.ev.on("connection.update", async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            // se fechar, tenta reconectar a menos que tenha sido deslogado manualmente
            const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectWhatsApp();
        } else if (connection === "open") {
            console.log("✅ [WHATSAPP CONNECTED]");
        }
    });

    // salva as credenciais sempre que houver uma atualização (importante para não deslogar)
    sock.ev.on("creds.update", saveCreds);
    return sock;
}

// função que envia a mensagem formatada para um grupo ou chat específico
export async function sendJob(job, jid) {
    if (!socketInstance) return console.error("❌ socket não inicializado");
    try {
        // formata a vaga usando o nosso utilitário de texto
        const message = await formatJobMessage(job);
        // envia a mensagem de texto
        await socketInstance.sendMessage(jid, { text: message });
        console.log(`✅ [success] enviada para: ${jid}`);
    } catch (error) {
        console.error(`❌ [error] falha ao enviar: ${error.message}`);
    }
}



