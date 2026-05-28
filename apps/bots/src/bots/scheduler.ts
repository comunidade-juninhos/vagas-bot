import cron from 'node-cron';
import type { Client } from 'discord.js';
import { getPendingDiscordVagas, updateVagaStatus } from '#root/services/vagaService.js';
import { config } from '../config/index.js';
import { sendWhatsAppBatch } from '../platforms/whatsapp.js';

/**
 * Inicia o agendador de tarefas curadas
 */
export function startScheduler(discordClient?: Client | null) {
    // Agendado para 09h, 13h, 18h e 21h todos os dias
    // O padrão cron: minuto hora dia-do-mês mês dia-da-semana
    cron.schedule('0 9,13,18,21 * * *', async () => {
        const hour = new Date().getHours();
        console.log(`⏰ [scheduler] Iniciando lote das ${hour}h...`);
        await sendBatchDigest(discordClient, 5);
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('📅 [scheduler] Agendador de Lotes iniciado (09h, 13h, 18h, 21h)');
}

/**
 * Busca X vagas pendentes e envia um lote com ping
 */
export async function sendBatchDigest(client?: Client | null, limit: number = 5) {
    try {
        // Busca as vagas que ainda não foram enviadas
        const jobs = await getPendingDiscordVagas(limit);

        if (jobs.length === 0) {
            console.log('ℹ️ [scheduler] Nenhuma vaga nova pendente no banco. Pulando lote.');
            return;
        }

        // Tenta enviar pro Discord
        if (config.discord.enabled && config.discord.channelId && config.discord.mentionRole && client) {
            try {
                const channel = await client.channels.fetch(config.discord.channelId);
                if (channel && ("send" in channel)) {
                    let message = `🚀 **TOP VAGAS DO MOMENTO** <@&${config.discord.mentionRole}>\n`;
                    message += `Selecionamos **${jobs.length}** novas oportunidades exclusivas para vocês!\n\n`;

                    for (const job of jobs) {
                        message += `• **${job.title}** (${job.company})\n  🔗 <${job.url}>\n\n`;
                    }
                    message += `*Fique ligado! O próximo lote de vagas chega em algumas horas.* ⏳`;
                    
                    await (channel as any).send(message);
                }
            } catch (discordErr) {
                console.error('❌ [scheduler] Erro ao enviar Discord:', discordErr);
            }
        } else {
            console.log('⚠️ [scheduler] Discord não configurado ou desativado. Pulando.');
        }

        // Envia para o WhatsApp se configurado
        if (config.whatsapp.enabled && config.whatsapp.groupId) {
            await sendWhatsAppBatch(jobs, config.whatsapp.groupId);
        } else {
            console.log('⚠️ [scheduler] WhatsApp não configurado (ou groupId ausente). Pulando.');
        }

        // Marca as vagas como enviadas no banco para não repetir no próximo lote
        for (const job of jobs) {
            await updateVagaStatus(job._id, { sent_discord: true, sent_whatsapp: true });
        }

        console.log(`✅ [scheduler] Lote enviado com ${jobs.length} vagas.`);
    } catch (error) {
        console.error('❌ [scheduler] Erro ao enviar lote:', error instanceof Error ? error.message : String(error));
    }
}
