import { fetchRemotarJobs, normalizeRemotarJob } from '../../packages/sources/remotar/index.js';
import { fetchGupyJobs, normalizeGupyJob } from '../../packages/sources/gupy/index.js';
import { config } from '../config/index.js';

/**
 * serviço responsável por orquestrar a busca e avisar o bot
 * ele liga os scrapers das pastas 'packages' com o servidor do bot
 */
export async function runScrapersAndNotify() {
    const startedAt = Date.now();
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

        console.log(`✅ [scraper-service] ${allJobs.length} vagas encontradas. enviando para o bot aos poucos...`);

        // limita a 2 vagas por ciclo para nao floodar o grupo
        const MAX_JOBS_PER_RUN = 2;
        let sentCount = 0;
        let notifyErrorCount = 0;

        for (const job of allJobs) {
            if (sentCount >= MAX_JOBS_PER_RUN) {
                console.log(`⏸️ [scraper-service] limite de ${MAX_JOBS_PER_RUN} vagas por ciclo atingido. aguardando o proximo ciclo.`);
                break;
            }
            const wasSent = await notifyBot(job);
            if (wasSent) {
                sentCount++;
            } else {
                notifyErrorCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 3000)); // pequena pausa entre envios
        }

        const summary = {
            foundJobs: allJobs.length,
            sentJobs: sentCount,
            notifyErrors: notifyErrorCount,
            maxPerRun: MAX_JOBS_PER_RUN,
            durationMs: Date.now() - startedAt
        };

        console.log(`📊 [scraper-service] ciclo finalizado | encontradas=${summary.foundJobs} | enviadas=${summary.sentJobs} | falhas=${summary.notifyErrors} | duracaoMs=${summary.durationMs}`);
        return summary;

    } catch (error) {
        console.error("❌ [scraper-service] erro durante o scraping:", error.message);
        return {
            foundJobs: 0,
            sentJobs: 0,
            notifyErrors: 1,
            maxPerRun: 2,
            durationMs: Date.now() - startedAt,
            error: error.message
        };
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
            return true; // retorna true para contabilizar o envio
        }
        return false;
    } catch (err) {
        console.error(`❌ [notify] erro ao enviar vaga ${job.title}:`, err.message);
    }
}

