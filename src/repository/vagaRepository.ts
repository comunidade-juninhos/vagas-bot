import mongoose from "mongoose";
import VagaModel from "../models/vaga.js";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

type QueryRecord = Record<string, any>;
type CursorData = { field: string; value: string; id: string } | null;

const SORT_MAP: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1, _id: -1 },
  scraped: { scrapedAt: -1, _id: -1 },
  published: { publishedAt: -1, _id: -1 },
};

const LIST_PROJECTION = "-description";

const escapeRegex = (value: unknown) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const safeLimit = (limit: unknown) =>
  Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), MAX_LIMIT);

const encodeCursor = (doc: any, sort = "newest") => {
  if (!doc) return null;

  const field =
    sort === "scraped"
      ? "scrapedAt"
      : sort === "published"
        ? "publishedAt"
        : "createdAt";

  const date = doc[field] ?? doc.createdAt;

  return Buffer.from(
    JSON.stringify({
      field,
      value: date instanceof Date ? date.toISOString() : date,
      id: String(doc._id),
    }),
  ).toString("base64url");
};

const decodeCursor = (cursor: unknown): CursorData => {
  if (!cursor) return null;

  try {
    return JSON.parse(Buffer.from(String(cursor), "base64url").toString("utf8"));
  } catch {
    return null;
  }
};

const buildFilters = (filters: QueryRecord = {}) => {
  const { stack, workMode, seniority, source, company, search } = filters;

  const query: QueryRecord = {};

  if (stack) {
    query.stack = Array.isArray(stack) ? { $in: stack } : stack;
  }

  if (workMode) {
    query.workMode = workMode;
  }

  if (seniority) {
    query.seniority = seniority;
  }

  if (source) {
    query.source = source;
  }

  if (company) {
    query.company = new RegExp(escapeRegex(company), "i");
  }

  if (search) {
    query.$text = { $search: String(search) };
  }

  return query;
};

const applyCursor = (query: QueryRecord, cursorData: CursorData) => {
  if (!cursorData?.field || !cursorData?.value || !cursorData?.id) {
    return query;
  }

  const date = new Date(cursorData.value);

  if (Number.isNaN(date.getTime()) || !mongoose.Types.ObjectId.isValid(cursorData.id)) {
    return query;
  }

  return {
    ...query,
    $or: [
      { [cursorData.field]: { $lt: date } },
      {
        [cursorData.field]: date,
        _id: { $lt: new mongoose.Types.ObjectId(cursorData.id) },
      },
    ],
  };
};

export async function createVaga(data: QueryRecord) {
  return VagaModel.create(data);
}

export async function updateVagaStatus(id: unknown, updateData: QueryRecord) {
  return VagaModel.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
}

// remove vagas com mais de 30 dias para manter o banco leve
export async function cleanupOldJobs() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  try {
    const result = await VagaModel.deleteMany({ createdAt: { $lt: thirtyDaysAgo } });
    console.log(`🧹 [database] limpeza concluída: ${result.deletedCount} vagas antigas removidas.`);
  } catch (err) {
    console.error('❌ [database] erro na limpeza de vagas antigas:', err instanceof Error ? err.message : String(err));
  }
}

export async function findVagaById(id: string) {

  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  return VagaModel.findById(id).lean().maxTimeMS(5000);
}

export async function findVagaByUrl(url: string) {
  return VagaModel.findOne({ url }).lean().maxTimeMS(5000);
}

export async function findVagaByContentHash(contentHash: string) {
  return VagaModel.findOne({ contentHash }).lean().maxTimeMS(5000);
}

export async function createVagaIfNotExists(data: QueryRecord) {
  try {
    const created = await VagaModel.create(data);

    return {
      created: true,
      vaga: created,
    };
  } catch (error) {
    const duplicateError = error as { code?: number };
    if (duplicateError.code !== 11000) {
      throw error;
    }

    const or = [];

    if (data.url) or.push({ url: data.url });
    if (data.contentHash) or.push({ contentHash: data.contentHash });
    if (data.source && data.externalId) {
      or.push({ source: data.source, externalId: data.externalId });
    }

    const existing = or.length
      ? await VagaModel.findOne({ $or: or }).lean().maxTimeMS(5000)
      : null;

    return {
      created: false,
      vaga: existing,
    };
  }
}

export async function listVagas(filters: QueryRecord = {}, options: QueryRecord = {}) {
  const {
    limit = DEFAULT_LIMIT,
    cursor = null,
    sort = "newest",
    includeDescription = false,
  } = options;

  const selectedSort = SORT_MAP[String(sort)] ?? SORT_MAP.newest;
  const queryBase = buildFilters(filters);
  const cursorData = decodeCursor(cursor);
  const query = applyCursor(queryBase, cursorData);
  const finalLimit = safeLimit(limit);

  const mongoQuery = VagaModel.find(query);
  if (!includeDescription) {
    mongoQuery.select(LIST_PROJECTION);
  }

  const items = await mongoQuery
    .sort(selectedSort)
    .limit(finalLimit + 1)
    .lean()
    .maxTimeMS(8000);

  const hasNextPage = items.length > finalLimit;
  const pageItems = hasNextPage ? items.slice(0, finalLimit) : items;
  const nextCursor = hasNextPage
    ? encodeCursor(pageItems[pageItems.length - 1], sort)
    : null;

  return {
    items: pageItems,
    pagination: {
      limit: finalLimit,
      hasNextPage,
      nextCursor,
    },
  };
}

export async function listRecentVagas(limit: unknown = DEFAULT_LIMIT) {
  const finalLimit = safeLimit(limit);

  return VagaModel.find()
    .select(LIST_PROJECTION)
    .sort({ createdAt: -1, _id: -1 })
    .limit(finalLimit)
    .lean()
    .maxTimeMS(8000);
}
