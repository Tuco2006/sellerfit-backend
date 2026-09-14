import { Router } from "express";
import { z } from "zod";
import { analisarTranscricao } from "../services/aiService";
import { calcularMatches } from "../services/matchService";

export const analiseRouter = Router();

const entradaSchema = z.object({
  clienteNome: z.string().min(1, "informe o nome do cliente"),
  empresa: z.string().min(1, "informe a empresa"),
  segmento: z.string().min(1, "informe o segmento"),
  transcricao: z.string().min(20, "a transcricao precisa ter pelo menos 20 caracteres"),
});

analiseRouter.post("/", async (req, res) => {
  const validacao = entradaSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({ erro: "dados invalidos", detalhes: validacao.error.flatten() });
  }

  try {
    const analise = await analisarTranscricao(validacao.data);
    const matches = calcularMatches(analise);

    res.json({ analise, matches });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "falha ao processar a analise" });
  }
});
