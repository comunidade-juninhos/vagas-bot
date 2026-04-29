import { Router } from "express";
import {
  listarVagas,
  listarRecentes,
  criarVaga,
} from "../controllers/vagaController.js";

const router = Router();

router.get("/jobs", listarVagas);
router.get("/jobs/recent", listarRecentes);

// opcional (debug/teste)
router.post("/jobs", criarVaga);

export default router;
