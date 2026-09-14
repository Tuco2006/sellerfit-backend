import {
  entidadesConcorrentes,
  entidadesEcossistema,
  palavrasOportunidade,
  palavrasProblema,
} from "../data/entidades";
import { SinalNegocio, ZonaNps } from "../types";

function contemTermo(texto: string, termos: string[]): boolean {
  return termos.some((termo) => {
    const padrao = new RegExp(`\\b${termo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
    return padrao.test(texto);
  });
}

function sinalizarEntidades(texto: string, entidades: Record<string, string[]>): string[] {
  const encontradas: string[] = [];

  for (const [entidade, termos] of Object.entries(entidades)) {
    if (contemTermo(texto, termos)) {
      encontradas.push(entidade.replace(/^totvs_/, "").replace(/^concorrente_/, ""));
    }
  }

  return encontradas;
}

export function classificarZonaNps(nota?: number): ZonaNps {
  if (nota === undefined || nota === null || Number.isNaN(nota)) return "Sem nota";
  if (nota >= 9) return "Promotor";
  if (nota >= 7) return "Passivo";
  return "Detrator";
}

export interface ResultadoSinalNegocio {
  sinalNegocio: SinalNegocio;
  justificativaSinal: string;
  zonaNps: ZonaNps;
  mencoesTotvs: string[];
  mencoesConcorrentes: string[];
}

// mesma regra de negócio usada pra rotular o dataset no notebook do desafio de data science:
// Detrator + (concorrente ou problema) = risco de churn / Promotor + oportunidade = upsell
export function calcularSinalNegocio(transcricao: string, notaNps?: number): ResultadoSinalNegocio {
  const texto = transcricao.toLowerCase();

  const mencoesTotvs = sinalizarEntidades(texto, entidadesEcossistema);
  const mencoesConcorrentes = sinalizarEntidades(texto, entidadesConcorrentes);

  const possuiProblema = contemTermo(texto, palavrasProblema);
  const possuiOportunidade = contemTermo(texto, palavrasOportunidade);
  const zonaNps = classificarZonaNps(notaNps);

  const mencionaConcorrente = mencoesConcorrentes.length > 0;

  if (mencionaConcorrente && possuiProblema) {
    return {
      sinalNegocio: "ALERTA_CHURN",
      justificativaSinal: `Cliente mencionou concorrente (${mencoesConcorrentes.join(", ")}) junto com sinais de insatisfação no texto.`,
      zonaNps,
      mencoesTotvs,
      mencoesConcorrentes,
    };
  }

  if (zonaNps === "Detrator" && (mencionaConcorrente || possuiProblema)) {
    return {
      sinalNegocio: "ALERTA_CHURN",
      justificativaSinal: `NPS na zona Detrator combinado com ${
        mencionaConcorrente ? "menção a concorrente" : "sinais de problema no texto"
      }.`,
      zonaNps,
      mencoesTotvs,
      mencoesConcorrentes,
    };
  }

  if (zonaNps === "Promotor" && possuiOportunidade) {
    return {
      sinalNegocio: "OPORTUNIDADE_UPSELL",
      justificativaSinal: "NPS na zona Promotor combinado com sinais de interesse comercial no texto.",
      zonaNps,
      mencoesTotvs,
      mencoesConcorrentes,
    };
  }

  if (zonaNps === "Sem nota" && possuiOportunidade && !possuiProblema) {
    return {
      sinalNegocio: "OPORTUNIDADE_UPSELL",
      justificativaSinal: "Sem nota de NPS informada, mas o texto tem sinais claros de interesse comercial.",
      zonaNps,
      mencoesTotvs,
      mencoesConcorrentes,
    };
  }

  if (zonaNps === "Sem nota" && possuiProblema && mencionaConcorrente) {
    return {
      sinalNegocio: "ALERTA_CHURN",
      justificativaSinal: "Sem nota de NPS informada, mas o texto cita concorrente junto com sinais de problema.",
      zonaNps,
      mencoesTotvs,
      mencoesConcorrentes,
    };
  }

  return {
    sinalNegocio: "NEUTRO",
    justificativaSinal: "Não foram identificados sinais suficientes de risco de churn ou oportunidade de upsell.",
    zonaNps,
    mencoesTotvs,
    mencoesConcorrentes,
  };
}
