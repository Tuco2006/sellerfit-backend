export type Urgencia = "BAIXA" | "MEDIA" | "ALTA";

export interface Atendente {
  id: string;
  nome: string;
  cargo: string;
  avatarCor: string;
  iniciais: string;
  tracos: string[];
  segmentos: string[];
  bio: string;
  anosExperiencia: number;
  notaMedia: number;
  casesResolvidos: number;
  disponibilidade: "Disponivel" | "Em atendimento" | "Ausente";
}

export interface AnaliseTranscricao {
  dores: string[];
  urgencia: Urgencia;
  resumoPerfil: string;
  tracosRecomendados: string[];
  segmentoDetectado: string;
  sentimentoGeral: string;
  origemAnalise: "openai" | "motor-local";
}

export interface MatchAtendente {
  atendente: Atendente;
  score: number;
  motivo: string;
}

export interface ResultadoAnalise {
  analise: AnaliseTranscricao;
  matches: MatchAtendente[];
}

export interface EntradaAnalise {
  clienteNome: string;
  empresa: string;
  segmento: string;
  transcricao: string;
}
