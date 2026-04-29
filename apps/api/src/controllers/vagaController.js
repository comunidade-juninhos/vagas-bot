import {
  getVagas,
  getRecentVagas,
  createVaga,
} from "#root/services/vagaService.js";

export async function listarVagas(req, res) {
  try {
    const {
      stack,
      workMode,
      seniority,
      source,
      company,
      search,
      limit,
      cursor,
      sort,
    } = req.query;

    const filters = {
      stack,
      workMode,
      seniority,
      source,
      company,
      search,
    };

    const options = {
      limit,
      cursor,
      sort,
    };

    const result = await getVagas(filters, options);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar vagas" });
  }
}

export async function listarRecentes(req, res) {
  try {
    const { limit } = req.query;

    const result = await getRecentVagas(limit);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao listar vagas recentes" });
  }
}

// opcional (pra testar)
export async function criarVaga(req, res) {
  try {
    const result = await createVaga(req.body);

    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erro ao criar vaga" });
  }
}
