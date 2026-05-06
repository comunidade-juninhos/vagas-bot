import cron from 'node-cron';
import type { Client } from 'discord.js';
import { getVagasForDigest } from '#root/services/vagaService.js';
import { config } from '../config/index.js';

/**
 * Inicia o agendador de tarefas
 */
export function startScheduler(discordClient: Client) {
    // Agendado para as 09:00 todos os dias no fuso de Brasília
    cron.schedule('0 9 * * *', async () => {
        console.log('⏰ [scheduler] Iniciando resumo diário de vagas...');
        await sendDailyDigest(discordClient);
    }, {
        timezone: "America/Sao_Paulo"
    });

    console.log('📅 [scheduler] Agendador iniciado (Resumo diário às 09:00)');
}

/**
 * Busca vagas das últimas 24h e envia um resumo com ping
 */
export async function sendDailyDigest(client: Client) {
    if (!config.discord.enabled || !config.discord.channelId || !config.discord.mentionRole) {
        console.log('⚠️ [scheduler] Discord ou Cargo de Menção não configurados. Pulando resumo.');
        return;
    }

    try {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

        const jobs = await getVagasForDigest(twentyFourHoursAgo);

        if (jobs.length === 0) {
            console.log('ℹ️ [scheduler] Nenhuma vaga nova encontrada nas últimas 24h. Pulando ping.');
            return;
        }

        const channel = await client.channels.fetch(config.discord.channelId);
        if (!channel || !("send" in channel)) return;

        let message = `🚀 **RESUMO DE VAGAS DO DIA** <@&${config.discord.mentionRole}>\n`;
        message += `Encontramos **${jobs.length}** novas oportunidades nas últimas 24 horas!\n\n`;

        // Listar as 15 primeiras para não estourar o limite de caracteres do Discord
        const displayedJobs = jobs.slice(0, 15);
        for (const job of displayedJobs) {
            message += `• **${job.title}** (${job.company})\n  🔗 <${job.url}>\n\n`;
        }

        if (jobs.length > 15) {
            message += `*... e outras ${jobs.length - 15} vagas que você pode conferir subindo as mensagens deste canal!* 👆`;
        }

        await (channel as any).send(message);
        console.log(`✅ [scheduler] Resumo diário enviado (${jobs.length} vagas)`);
    } catch (error) {
        console.error('❌ [scheduler] Erro ao enviar resumo diário:', error instanceof Error ? error.message : String(error));
    }
}
