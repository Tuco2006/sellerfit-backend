import { Router } from "express";
import { z } from "zod";
import { analisarTranscricao } from "../services/aiService";
import { calcularMatches } from "../services/matchService";
import { calcularSinalNegocio } from "../services/sinalNegocioService";
import { classificarComML } from "../services/mlClassifierService";
import { atendentes } from "../data/atendentes";
import { AnaliseTranscricao, RecomendacaoIA } from "../types";

export const analiseRouter = Router();

const entradaSchema = z.object({
  clienteNome: z.string().min(1, "informe o nome do cliente"),
  empresa: z.string().min(1, "informe a empresa"),
  segmento: z.string().min(1, "informe o segmento"),
  transcricao: z.string().min(20, "a transcrição precisa ter pelo menos 20 caracteres"),
  notaNps: z.number().min(0).max(10).optional(),
});

analiseRouter.post("/", async (req, res) => {
  const validacao = entradaSchema.safeParse(req.body);

  if (!validacao.success) {
    return res.status(400).json({ erro: "dados inválidos", detalhes: validacao.error.flatten() });
  }

  try {
    const entrada = validacao.data;

    const [analiseTexto, sinal] = await Promise.all([
      analisarTranscricao(entrada),
      Promise.resolve(calcularSinalNegocio(entrada.transcricao, entrada.notaNps)),
    ]);

    const analise: AnaliseTranscricao = { ...analiseTexto, ...sinal };
    const matches = calcularMatches(analise);

    const classificacaoML = classificarComML(entrada.transcricao);
    // recalcula o match usando o sinal previsto pelo modelo de ML no lugar da regra de negócio,
    // pra essa segunda forma de análise ter sua própria recomendação de atendente
    const matchesML = calcularMatches({ ...analise, sinalNegocio: classificacaoML.sinal });

    // quando a OpenAI analisou de verdade o catálogo de atendentes e escolheu um, monta a recomendação
    let recomendacaoIA: RecomendacaoIA | undefined;
    if (analiseTexto.atendenteRecomendadoId) {
      const atendenteEscolhido = atendentes.find((a) => a.id === analiseTexto.atendenteRecomendadoId);
      if (atendenteEscolhido) {
        recomendacaoIA = {
          atendente: atendenteEscolhido,
          justificativa: analiseTexto.justificativaAtendente || "A IA recomendou esse atendente com base no perfil do cliente.",
        };
      }
    }

    res.json({ analise, matches, classificacaoML, matchesML, recomendacaoIA });
  } catch (erro) {
    console.error(erro);
    res.status(500).json({ erro: "falha ao processar a análise" });
  }
});
