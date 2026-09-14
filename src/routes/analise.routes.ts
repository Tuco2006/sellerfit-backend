import { Router } from "express";
import { z } from "zod";
import { analisarTranscricao } from "../services/aiService";
import { calcularMatches } from "../services/matchService";
import { calcularSinalNegocio } from "../services/sinalNegocioService";
import { AnaliseTranscricao } from "../types";

export const analiseRouter = Router();

const entradaSchema = z.object({
  clienteNome: z.string().min(1, "informe o nome do cliente"),
  empresa: z.string().min(1, "informe a empresa"),
  segmento: z.string().min(1, "informe o segmento"),
  transcricao: z.string().min(20, "a transcricao precisa ter pelo menos 20 caracteres"),
  notaNps: z.number().min(0).max(10).optional(),
});

analiseRouter.post("/", async (req, res) => {
  const validacao = entradaSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({ erro: "dados invalidos", detalhes: validacao.error.flatten() });
  }

  try {
    const entrada = validacao.data;

    const [analiseTexto, sinal] = await Promise.all([
      analisarTranscricao(entrada),
      Promise.resolve(calcularSinalNegocio(entrada.transcricao, entrada.notaNps)),
    ]);

    const analise: AnaliseTranscricao = { ...analiseTexto, ...sinal };
    const matches = calcularMatches(analise);

    res.json({ analise, matches });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "falha ao processar a analise" });
  }
});
