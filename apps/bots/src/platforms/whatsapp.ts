/**
 * WhatsApp module — DESATIVADO
 * O @whiskeysockets/baileys foi removido para compatibilidade com o HuggingFace.
 * Para reativar, adicione `@whiskeysockets/baileys` de volta ao package.json
 * e restaure o conteúdo original deste arquivo.
 */

import type { JobDTO } from '../../../../packages/core/types.js';

export let currentPairingCode = "WHATSAPP DESATIVADO";
export let currentQRCode: string | null = null;

export function getWhatsAppStatus() {
    return {
        isReady: false,
        hasSocket: false,
        lastReadyAt: null,
        lastCloseAt: null,
        reconnectInProgress: false,
        consecutiveSendFailures: 0
    };
}

export async function connectWhatsApp() {
    console.log("⏸️ [whatsapp] Baileys removido — WhatsApp desativado neste ambiente.");
    return null;
}

export async function sendJob(_job: JobDTO, _jid: string): Promise<boolean> {
    console.log("⏸️ [whatsapp] sendJob ignorado — WhatsApp desativado.");
    return false;
}

export async function sendWhatsAppBatch(_jobs: JobDTO[], _jid: string): Promise<boolean> {
    console.log("⏸️ [whatsapp] sendWhatsAppBatch ignorado — WhatsApp desativado.");
    return false;
}
