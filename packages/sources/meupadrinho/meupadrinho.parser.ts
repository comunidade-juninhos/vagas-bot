import {
  detectSeniority,
  detectWorkMode,
  extractStack,
  parseDate,
  stripHtml,
} from "../../core/normalize-job.js";
import { detectApplySourceFromUrl } from "../../core/source.js";
import type { JobDTO, Seniority, WorkMode } from "../../core/types.js";

export type MeuPadrinhoJob = {
  titulo_vaga?: string | null;
  empresa_nome?: string | null;
  nome_empresa?: string | null;
  local?: string | null;
  horario_registro?: string | null;
  link_vaga?: string | null;
  link_plataforma_publicado?: string | null;
  plataforma?: string | null;
  forma_trabalho?: string | null;
  cargo?: string | null;
  nivel?: string | null;
  nivel_vaga?: string | null;
  nano_id: string;
  slug?: string | null;
  descricao_vaga?: string | null;
  requisitos_tecnicos?: string | null;
  beneficios_empresa?: string | null;
  requisitos_desejaveis?: string | null;
  tipo_contrato?: string | null;
  salario?: string | null;
  vaga_encerrada?: boolean | null;
};

const mapWorkMode = (value: string | null | undefined): WorkMode => {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("remoto")) return "remote";
  if (normalized.includes("híbrido") || normalized.includes("hibrido")) return "hybrid";
  if (normalized.includes("presencial")) return "onsite";
  return detectWorkMode(normalized);
};

const mapSeniority = (value: string | null | undefined, title: string): Seniority => {
  const normalized = value?.toLowerCase() ?? "";
  if (normalized.includes("estágio") || normalized.includes("estagio")) return "intern";
  if (normalized.includes("júnior") || normalized.includes("junior")) return "junior";
  if (normalized.includes("pleno") || normalized.includes("mid")) return "mid";
  if (normalized.includes("sênior") || normalized.includes("senior")) return "senior";
  return detectSeniority(title);
};

const joinSections = (job: MeuPadrinhoJob): string | undefined => {
  const sections = [
    stripHtml(job.descricao_vaga ?? ""),
    job.requisitos_tecnicos ? `Requisitos: ${stripHtml(job.requisitos_tecnicos)}` : "",
    job.requisitos_desejaveis ? `Desejáveis: ${stripHtml(job.requisitos_desejaveis)}` : "",
    job.beneficios_empresa ? `Benefícios: ${stripHtml(job.beneficios_empresa)}` : "",
    job.tipo_contrato ? `Contrato: ${stripHtml(job.tipo_contrato)}` : "",
    job.nivel_vaga ? `Nível: ${stripHtml(job.nivel_vaga)}` : "",
    job.salario ? `Salário: ${stripHtml(job.salario)}` : "",
  ].filter(Boolean);

  return sections.join("\n") || undefined;
};

export const normalizeMeuPadrinhoJob = (job: MeuPadrinhoJob): JobDTO => {
  const title = (job.titulo_vaga ?? "").trim();
  const company = (job.nome_empresa ?? job.empresa_nome ?? "Empresa não informada").trim();
  const description = joinSections(job);
  const url = job.link_vaga || job.link_plataforma_publicado || `https://meupadrinho.com.br/vaga/${job.nano_id}`;
  const stack = extractStack([
    title,
    job.cargo,
    description,
  ]);

  return {
    source: detectApplySourceFromUrl(url),
    externalId: job.nano_id,
    title,
    company,
    location: job.local ?? undefined,
    workMode: mapWorkMode(job.forma_trabalho),
    seniority: mapSeniority(job.nivel_vaga ?? job.nivel, title),
    url,
    description,
    stack,
    publishedAt: parseDate(job.horario_registro ?? undefined),
    scrapedAt: new Date(),
  };
};
