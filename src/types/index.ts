export type Urgencia = "BAIXA" | "MEDIA" | "ALTA";
export type SinalNegocio = "ALERTA_CHURN" | "OPORTUNIDADE_UPSELL" | "NEUTRO";
export type ZonaNps = "Promotor" | "Passivo" | "Detrator" | "Sem nota";
export type Foco = "retencao" | "cross-sell";

export interface Atendente {
  id: string;
  nome: string;
  cargo: string;
  avatarCor: string;
  iniciais: string;
  tracos: string[];
  segmentos: string[];
  foco: Foco[];
  bio: string;
  anosExperiencia: number;
  notaMedia: number;
  casesResolvidos: number;
  disponibilidade: "Disponivel" | "Em atendimento" | "Ausente";
}

export interface AnaliseTexto {
  dores: string[];
  urgencia: Urgencia;
  resumoPerfil: string;
  tracosRecomendados: string[];
  segmentoDetectado: string;
  sentimentoGeral: string;
  origemAnalise: "openai" | "motor-local";
}

export interface AnaliseTranscricao extends AnaliseTexto {
  sinalNegocio: SinalNegocio;
  justificativaSinal: string;
  zonaNps: ZonaNps;
  mencoesTotvs: string[];
  mencoesConcorrentes: string[];
}

export interface MatchAtendente {
  atendente: Atendente;
  score: number;
  motivo: string;
}

export interface ClassificacaoML {
  sinal: SinalNegocio;
  confianca: number;
  probabilidades: Record<SinalNegocio, number>;
}

export interface ResultadoAnalise {
  analise: AnaliseTranscricao;
  matches: MatchAtendente[];
  classificacaoML: ClassificacaoML;
}

export interface EntradaAnalise {
  clienteNome: string;
  empresa: string;
  segmento: string;
  transcricao: string;
  notaNps?: number;
}
