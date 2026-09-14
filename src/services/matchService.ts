import { atendentes } from "../data/atendentes";
import { AnaliseTranscricao, Atendente, MatchAtendente } from "../types";

// normaliza pra ignorar diferenca de genero tipo "direto" / "direta"
function normalizar(palavra: string): string {
  const p = palavra.trim().toLowerCase();
  if (p.length > 4 && (p.endsWith("a") || p.endsWith("o"))) {
    return p.slice(0, -1);
  }
  return p;
}

function calcularScore(atendente: Atendente, analise: AnaliseTranscricao): { score: number; tracosBatidos: string[] } {
  const tracosRecomendados = analise.tracosRecomendados.map(normalizar);
  const tracosAtendente = atendente.tracos.map(normalizar);

  const tracosBatidos = atendente.tracos.filter((t) => tracosRecomendados.includes(normalizar(t)));
  const percentualTracos = tracosRecomendados.length > 0 ? tracosBatidos.length / tracosRecomendados.length : 0;

  const segmentoBate = atendente.segmentos.some(
    (s) => normalizar(s) === normalizar(analise.segmentoDetectado)
  );

  const scoreTracos = percentualTracos * 60;
  const scoreSegmento = segmentoBate ? 25 : 0;
  const scoreNota = (atendente.notaMedia / 10) * 15;

  const score = Math.round(scoreTracos + scoreSegmento + scoreNota);

  return { score: Math.min(score, 100), tracosBatidos };
}

function gerarMotivo(atendente: Atendente, tracosBatidos: string[], segmentoBate: boolean): string {
  const partes: string[] = [];

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
    const { score, tracosBatidos } = calcularScore(atendente, analise);
    const segmentoBate = atendente.segmentos.some(
      (s) => normalizar(s) === normalizar(analise.segmentoDetectado)
    );

    return {
      atendente,
      score,
      motivo: gerarMotivo(atendente, tracosBatidos, segmentoBate),
    };
  });

  return calculados.sort((a, b) => b.score - a.score).slice(0, limite);
}
