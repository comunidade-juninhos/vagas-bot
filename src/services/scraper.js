import { fetchRemotarJobs, normalizeRemotarJob } from '../../packages/sources/remotar/index.js';
import { fetchGupyJobs, normalizeGupyJob } from '../../packages/sources/gupy/index.js';
import { config } from '../config/index.js';

/**
 * serviço responsável por orquestrar a busca e avisar o bot
 * ele liga os scrapers das pastas 'packages' com o servidor do bot
 */
export async function runScrapersAndNotify() {
    console.log("🔍 [scraper-service] iniciando busca de vagas...");

    try {
        // busca vagas (aqui você pode configurar quantas páginas quer buscar)
        const remotarSourceJobs = await fetchRemotarJobs({ maxPages: 1, active: true });
        const gupySourceJobs = await fetchGupyJobs({ keywords: ["javascript", "node", "react"], maxPagesPerKeyword: 1 });

        // transforma os dados brutos no formato padrão da nossa classe 'vaga'
        const allJobs = [
            ...remotarSourceJobs.map(j => normalizeRemotarJob(j.raw)),
            ...gupySourceJobs.map(j => normalizeGupyJob(j.raw))
        ];

        console.log(`✅ [scraper-service] ${allJobs.length} vagas encontradas. enviando para o bot...`);

        // passa por cada vaga encontrada e avisa o bot via webhook
        for (const job of allJobs) {
            await notifyBot(job);
        }

    } catch (error) {
        console.error("❌ [scraper-service] erro durante o scraping:", error.message);
    }
}

// função que faz o 'post' para a nossa própria api/bot (webhook)
async function notifyBot(job) {
    try {
        const response = await fetch(config.webhook.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(job)
        });

        if (response.ok) {
            console.log(`✅ [notify] vaga enviada: ${job.title}`);
        }
    } catch (err) {
        console.error(`❌ [notify] erro ao enviar vaga ${job.title}:`, err.message);
    }
}

