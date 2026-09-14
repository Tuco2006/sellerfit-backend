import { Router } from "express";
import { atendentes } from "../data/atendentes";

export const atendentesRouter = Router();

atendentesRouter.get("/", (_req, res) => {
  res.json(atendentes);
});

atendentesRouter.get("/:id", (req, res) => {
  const atendente = atendentes.find((a) => a.id === req.params.id);

  if (!atendente) {
    return res.status(404).json({ erro: "Atendente não encontrado" });
  }

  res.json(atendente);
});
