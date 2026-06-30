import "dotenv/config";
import { connectDatabase, disconnectDatabase } from "../src/services/database.js";
import { createVaga, getPendingDiscordVagas, updateVagaStatus, filterJuniorAndIntern } from "../src/services/vagaService.js";
import { fetchGupyJobs, isTechGupyJob, normalizeGupyJob } from "../packages/sources/gupy/index.js";
import { fetchMeuPadrinhoJobs, normalizeMeuPadrinhoJob } from "../packages/sources/meupadrinho/index.js";
import { fetchRemotarJobs, isTechRemotarJob, normalizeRemotarJob } from "../packages/sources/remotar/index.js";
import { fetchCieeJobs, normalizeCieeJob } from "../packages/sources/ciee/index.js";
import { dedupeJobs } from "../packages/core/dedupe.js";
import type { JobDTO } from "../packages/core/types.js";

async function main() {
    console.log("⏰ [cron-job] Iniciando script de scrape + envio ao Discord Webhook...");
    
    // 1. Conectar ao Banco
    await connectDatabase();
    
    // 2. Definir fontes ativas
    const sources = (process.env.JOB_SOURCES || "meupadrinho,remotar,gupy,ciee")
        .split(",")
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
        
    console.log(`📡 Fontes ativas para este ciclo: ${sources.join(", ")}`);
    
    // 3. Executar Scrapers
    let fetchedJobs: JobDTO[] = [];
    
    // 3a. Meu Padrinho
    if (sources.includes("meupadrinho")) {
        try {
            console.log("📥 Buscando vagas do MeuPadrinho...");
            const maxPages = Number(process.env.MEUPADRINHO_MAX_PAGES || 5);
            const raw = await fetchMeuPadrinhoJobs({ maxPages });
            const normalized = raw.map(j => normalizeMeuPadrinhoJob(j.raw));
            fetchedJobs.push(...normalized);
            console.log(`   ✅ MeuPadrinho: ${normalized.length} vagas obtidas.`);
        } catch (e) {
            console.error("❌ Erro no scraper MeuPadrinho:", e);
        }
    }
    
    // 3b. Remotar
    if (sources.includes("remotar")) {
        try {
            console.log("📥 Buscando vagas da Remotar...");
            const maxPages = Number(process.env.REMOTAR_MAX_PAGES || 5);
            const raw = await fetchRemotarJobs({ maxPages, active: true });
            const normalized = raw
                .map(j => j.raw)
                .filter(isTechRemotarJob)
                .map(normalizeRemotarJob);
            fetchedJobs.push(...normalized);
            console.log(`   ✅ Remotar: ${normalized.length} vagas obtidas.`);
        } catch (e) {
            console.error("❌ Erro no scraper Remotar:", e);
        }
    }
    
    // 3c. Gupy
    if (sources.includes("gupy")) {
        try {
            console.log("📥 Buscando vagas da Gupy...");
            const maxPages = Number(process.env.GUPY_MAX_PAGES_PER_KEYWORD || 1);
            const keywords = ["qa", "testes", "desenvolvedor", "desenvolvedora", "developer", "frontend", "backend", "fullstack", "mobile", "typescript", "node", "react"];
            const raw = await fetchGupyJobs({ keywords, maxPagesPerKeyword: maxPages });
            const normalized = raw
                .map(j => j.raw)
                .filter(isTechGupyJob)
                .map(normalizeGupyJob);
            fetchedJobs.push(...normalized);
            console.log(`   ✅ Gupy: ${normalized.length} vagas obtidas.`);
        } catch (e) {
            console.error("❌ Erro no scraper Gupy:", e);
        }
    }
    
    // 3d. CIEE
    if (sources.includes("ciee")) {
        try {
            console.log("📥 Buscando editais do CIEE...");
            const raw = await fetchCieeJobs();
            const normalized = raw.map(j => normalizeCieeJob(j.raw));
            fetchedJobs.push(...normalized);
            console.log(`   ✅ CIEE: ${normalized.length} vagas obtidas.`);
        } catch (e) {
            console.error("❌ Erro no scraper CIEE:", e);
        }
    }
    
    // 4. Deduplicar e Filtrar (Sniper)
    const deduped = dedupeJobs(fetchedJobs);
    const filtered = deduped.filter(filterJuniorAndIntern);
    console.log(`🔍 Total após deduplicação e filtro Sniper: ${filtered.length} vagas.`);
    
    // 5. Salvar novas vagas no banco diretamente
    let savedCount = 0;
    for (const job of filtered) {
        try {
            const result = await createVaga(job);
            if (result.created) {
                savedCount++;
            }
        } catch (e) {
            console.error(`❌ Erro ao salvar vaga "${job.title}":`, e);
        }
    }
    console.log(`💾 Salvas no banco: ${savedCount} novas vagas.`);
    
    // 6. Verificar se temos vagas pendentes e enviar lote para o Webhook do Discord
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) {
        console.log("⚠️ DISCORD_WEBHOOK_URL não configurado. Pulando envio ao Discord.");
        await disconnectDatabase();
        return;
    }
    
    // Busca até 5 vagas pendentes no banco
    const pendingJobs = await getPendingDiscordVagas(5);
    
    if (pendingJobs.length > 0) {
        console.log(`🚀 Enviando lote de ${pendingJobs.length} vagas para o Discord Webhook...`);
        
        const mentionRole = process.env.DISCORD_MENTION_ROLE;
        const rolePing = mentionRole ? `<@&${mentionRole}>` : "@everyone";
        
        let message = `🚀 **TOP VAGAS DO MOMENTO** ${rolePing}\n`;
        message += `Selecionamos **${pendingJobs.length}** novas oportunidades exclusivas para vocês!\n\n`;

        for (const job of pendingJobs) {
            message += `• **${job.title}** (${job.company})\n  🔗 <${job.url}>\n\n`;
        }
        message += `*Fique ligado! O próximo lote de vagas chega em breve.* ⏳`;
        
        // Envia requisição HTTP POST para o webhook
        const response = await fetch(webhookUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                content: message
            })
        });
        
        if (response.ok) {
            console.log("✅ Lote enviado com sucesso ao Discord!");
            // Marcar como enviadas no banco
            for (const job of pendingJobs) {
                await updateVagaStatus(job._id, { sent_discord: true });
            }
        } else {
            console.error(`❌ Falha ao enviar para o Discord. Status: ${response.status}`, await response.text());
        }
    } else {
        console.log("ℹ️ Nenhuma vaga nova pendente para enviar no lote.");
    }
    
    // 7. Desconectar Banco
    await disconnectDatabase();
    console.log("🏁 Script finalizado.");
}

main().catch(err => {
    console.error("❌ Falha crítica na execução:", err);
    process.exit(1);
});
