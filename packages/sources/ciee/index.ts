import type { JobDTO, RawJob } from "../../core/types.js";

type CieeFetchOptions = {
  listStatus?: string[];
};

// busca todos os processos seletivos publicos abertos na api do ciee (geralmente estagios de prefeituras, estados, etc)
export const fetchCieeJobs = async (options: CieeFetchOptions = {}): Promise<RawJob[]> => {
  const statusList = options.listStatus || ["ABERTO"];
  const allJobs: RawJob[] = [];
  
  try {
    let page = 0;
    let totalPages = 1;
    
    while (page < totalPages) {
      // faz requisicao post pedindo apenas editais com status definido (ex: ABERTO)
      const response = await fetch(`https://api-pp.ciee.org.br/api/editais/vitrine?page=${page}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ listStatus: statusList })
      });
      
      if (!response.ok) {
        throw new Error(`CIEE API responded with status ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.content && Array.isArray(data.content)) {
        for (const item of data.content) {
          allJobs.push({
            source: "ciee",
            raw: item
          });
        }
      }
      
      totalPages = data.totalPages || 0;
      page++;
    }
    
    return allJobs;
  } catch (error) {
    console.error("Error fetching CIEE jobs:", error);
    return [];
  }
};

// formata o edital recebido da api para o formato padrao do nosso banco (jobdto), setando tudo como estagio (intern)
export const normalizeCieeJob = (raw: any): JobDTO => {
  return {
    source: "ciee",
    externalId: String(raw.id),
    title: `Processo Seletivo Público - ${raw.orgao?.nome || "CIEE"} ${raw.identificacao || ""}`.trim(),
    company: raw.orgao?.nome || "CIEE",
    location: "Brasil",
    workMode: "unknown",
    seniority: "intern",
    url: `https://pp.ciee.org.br/vitrine/${raw.id}/detalhe`,
    summary: `Processo Seletivo Público (Estágio/Aprendiz): ${raw.identificacao || ""}`,
    description: "", 
    stack: [],
    scrapedAt: new Date(),
  };
};
