import { atendentes } from "../data/atendentes";
import { AnaliseTranscricao, Atendente, Foco, MatchAtendente } from "../types";

// normaliza pra ignorar diferenca de genero tipo "direto" / "direta"
function normalizar(palavra: string): string {
  const p = palavra.trim().toLowerCase();
  if (p.length > 4 && (p.endsWith("a") || p.endsWith("o"))) {
    return p.slice(0, -1);
  }
  return p;
}

// sinal de negocio pede um foco especifico do atendente (retencao pra churn, cross-sell pra upsell)
function focoEsperado(analise: AnaliseTranscricao): Foco | null {
  if (analise.sinalNegocio === "ALERTA_CHURN") return "retencao";
  if (analise.sinalNegocio === "OPORTUNIDADE_UPSELL") return "cross-sell";
  return null;
}

function calcularScore(
  atendente: Atendente,
  analise: AnaliseTranscricao
): { score: number; tracosBatidos: string[]; focoBate: boolean; segmentoBate: boolean } {
  const tracosRecomendados = analise.tracosRecomendados.map(normalizar);

  const tracosBatidos = atendente.tracos.filter((t) => tracosRecomendados.includes(normalizar(t)));
  const percentualTracos = tracosRecomendados.length > 0 ? tracosBatidos.length / tracosRecomendados.length : 0;

  const segmentoBate = atendente.segmentos.some(
    (s) => normalizar(s) === normalizar(analise.segmentoDetectado)
  );

  const focoAlvo = focoEsperado(analise);
  const focoBate = focoAlvo !== null && atendente.foco.includes(focoAlvo);

  const scoreTracos = percentualTracos * 50;
  const scoreSegmento = segmentoBate ? 20 : 0;
  const scoreNota = (atendente.notaMedia / 10) * 10;
  const scoreFoco = focoBate ? 20 : 0;

  const score = Math.round(scoreTracos + scoreSegmento + scoreNota + scoreFoco);

  return { score: Math.min(score, 100), tracosBatidos, focoBate, segmentoBate };
}

function gerarMotivo(
  atendente: Atendente,
  tracosBatidos: string[],
  segmentoBate: boolean,
  focoBate: boolean,
  analise: AnaliseTranscricao
): string {
  const partes: string[] = [];

  if (focoBate) {
    const rotulo = analise.sinalNegocio === "ALERTA_CHURN" ? "especialista em retencao de clientes" : "especialista em cross-sell";
    partes.push(rotulo);
  }
  if (tracosBatidos.length > 0) {
    partes.push(`perfil ${tracosBatidos.join(", ")}`);
  }
  if (segmentoBate) {
    partes.push(`experiencia no segmento do cliente`);
  }
  partes.push(`nota media ${atendente.notaMedia.toFixed(1)} em ${atendente.casesResolvidos} atendimentos`);

  return `Indicado por ${partes.join(" + ")}.`;
}

export function calcularMatches(analise: AnaliseTranscricao, limite = 3): MatchAtendente[] {
  const calculados = atendentes.map((atendente) => {
    const { score, tracosBatidos, focoBate, segmentoBate } = calcularScore(atendente, analise);

    return {
      atendente,
      score,
      motivo: gerarMotivo(atendente, tracosBatidos, segmentoBate, focoBate, analise),
    };
  });

  return calculados.sort((a, b) => b.score - a.score).slice(0, limite);
}
