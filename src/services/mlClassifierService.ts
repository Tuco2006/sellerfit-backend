import fs from "fs";
import path from "path";
import { ClassificacaoML, SinalNegocio } from "../types";

// mesma lista de stopwords usada no notebook do desafio de data science, pra
// limpar o texto do mesmo jeito que foi feito na hora de treinar o modelo
const STOPWORDS = new Set([
  "a", "o", "as", "os", "um", "uma", "uns", "umas", "de", "da", "do", "das", "dos",
  "em", "na", "no", "nas", "nos", "para", "pra", "por", "com", "sem", "e", "ou",
  "que", "quem", "qual", "quais", "como", "quando", "onde", "porque", "se", "mas",
  "eu", "você", "vocês", "ele", "ela", "eles", "elas", "nós", "tu", "me", "te",
  "meu", "minha", "meus", "minhas", "seu", "sua", "seus", "suas",
  "nosso", "nossa", "nossos", "nossas",
  "isso", "isto", "aquilo", "esse", "essa", "esses", "essas", "este", "esta",
  "estes", "estas", "aquele", "aquela", "aqueles", "aquelas",
  "aqui", "ali", "lá", "aí", "já", "ainda", "também", "então", "assim", "tipo",
  "agora", "depois", "hoje", "daí",
  "né", "tá", "aham", "uhum", "hum", "ah", "hã", "opa",
  "oi", "olá", "bom", "boa", "dia", "tarde", "noite", "pessoal", "gente", "cara",
  "tudo", "tal",
  "é", "tem", "vai", "fazer", "está", "só", "vou", "ter", "pode", "dentro",
  "ser", "até", "parte", "muito", "tenho", "bem", "acho", "foi", "sim", "são",
  "faz", "ver", "vamos", "exemplo", "coisa", "mesmo", "sei", "todo",
  "posso", "falar", "estou", "vão", "estão", "pelo", "toda", "todos", "dar",
  "nesse", "forma", "estar", "deixa", "temos", "momento", "outro", "outra",
  "tinha", "colocar", "pouco", "poder", "falando", "dele", "fica", "ao", "têm",
  "cada", "entender", "dá", "sabe", "era", "desse",
]);

interface ModeloExportado {
  vocabulario: Record<string, number>;
  idf: number[];
  classes: SinalNegocio[];
  coef: number[][];
  intercept: number[];
  maxFeatures: number;
}

let modelo: ModeloExportado | null = null;
let vocabularioInverso: string[] | null = null;

function carregarModelo(): ModeloExportado {
  if (modelo) return modelo;

  const caminho = path.join(__dirname, "..", "data", "modeloClassificador.json");
  const conteudo = fs.readFileSync(caminho, "utf-8");
  modelo = JSON.parse(conteudo);

  vocabularioInverso = new Array(modelo!.maxFeatures);
  for (const [termo, indice] of Object.entries(modelo!.vocabulario)) {
    vocabularioInverso[indice] = termo;
  }

  return modelo as ModeloExportado;
}

// mesma limpeza estrutural feita no notebook (remove marcação de locutor e anonimização)
function limparTranscricao(texto: string): string {
  let t = texto.toLowerCase();
  t = t.replace(/\[locutor\s+\d+\]:?/gi, " ");
  t = t.replace(/\[(pessoa|empresa|local)\]/gi, " ");
  t = t.replace(/\n/g, " ");
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

function removerStopwords(texto: string): string {
  const palavras = texto.toLowerCase().match(/[\wÀ-ÿ]+/g) || [];
  return palavras.filter((p) => !STOPWORDS.has(p)).join(" ");
}

function tokenizar(texto: string): string[] {
  return texto.match(/[\wÀ-ÿ]{2,}/g) || [];
}

function vetorizarTfidf(tokens: string[], m: ModeloExportado): number[] {
  const vetor = new Array(m.maxFeatures).fill(0);

  for (const token of tokens) {
    const indice = m.vocabulario[token];
    if (indice !== undefined) {
      vetor[indice] += 1;
    }
  }

  for (let i = 0; i < m.maxFeatures; i++) {
    vetor[i] *= m.idf[i];
  }

  let normaQuadrado = 0;
  for (let i = 0; i < m.maxFeatures; i++) normaQuadrado += vetor[i] * vetor[i];
  const norma = Math.sqrt(normaQuadrado) || 1;
  for (let i = 0; i < m.maxFeatures; i++) vetor[i] /= norma;

  return vetor;
}

// pega as palavras do próprio texto que mais pesaram pra classe prevista,
// usando os coeficientes reais do modelo (não é um texto genérico fixo)
function termosInfluentes(vetor: number[], m: ModeloExportado, indiceClasse: number, limite = 5): string[] {
  const linhaCoef = m.coef[indiceClasse];
  const contribuicoes: { termo: string; peso: number }[] = [];

  for (let i = 0; i < vetor.length; i++) {
    if (vetor[i] > 0) {
      const peso = vetor[i] * linhaCoef[i];
      if (peso > 0) {
        contribuicoes.push({ termo: vocabularioInverso![i], peso });
      }
    }
  }

  contribuicoes.sort((a, b) => b.peso - a.peso);
  return contribuicoes.slice(0, limite).map((c) => c.termo);
}

interface ExplicacaoClassificacao {
  motivo: string;
  janelasDeOportunidade: string[];
}

function montarExplicacao(sinal: SinalNegocio, termos: string[], confianca: number): ExplicacaoClassificacao {
  const confiancaPct = Math.round(confianca * 100);

  if (sinal === "ALERTA_CHURN") {
    const motivo =
      termos.length > 0
        ? `O modelo classificou essa conversa como risco de Churn com ${confiancaPct}% de confiança. As palavras "${termos.join('", "')}" foram as que mais pesaram nessa decisão, dentro do vocabulário que o modelo aprendeu nas reuniões reais do desafio.`
        : `O modelo classificou essa conversa como risco de Churn com ${confiancaPct}% de confiança, mas não achou uma palavra isolada dominante — o sinal veio da combinação de vários termos mais fracos do texto.`;

    return {
      motivo,
      janelasDeOportunidade: [
        "Contato imediato do time de Retenção, antes que o cliente formalize o cancelamento.",
        "Oferecer uma revisão de contrato, desconto ou plano alternativo pra reverter a insatisfação.",
        "Levantar o histórico de chamados desse cliente pra atacar a causa raiz do problema, não só o sintoma.",
      ],
    };
  }

  if (sinal === "OPORTUNIDADE_UPSELL") {
    const motivo =
      termos.length > 0
        ? `O modelo classificou essa conversa como Oportunidade de Upsell com ${confiancaPct}% de confiança. As palavras "${termos.join('", "')}" foram as que mais pesaram nessa decisão, dentro do vocabulário que o modelo aprendeu nas reuniões reais do desafio.`
        : `O modelo classificou essa conversa como Oportunidade de Upsell com ${confiancaPct}% de confiança, mas não achou uma palavra isolada dominante — o sinal veio da combinação de vários termos mais fracos do texto.`;

    return {
      motivo,
      janelasDeOportunidade: [
        "Levar uma proposta de upgrade ou módulo adicional enquanto o interesse do cliente está quente.",
        "Agendar uma demonstração focada exatamente no que o cliente mencionou querer expandir.",
        "Encaminhar pro time de Cross-sell com prioridade, antes que o interesse esfrie.",
      ],
    };
  }

  return {
    motivo: `O modelo não encontrou um padrão forte o suficiente de risco ou de interesse comercial nesse texto (confiança de ${confiancaPct}% pra Neutro). Isso não significa que não há nada acontecendo — só que o vocabulário da conversa não bateu com os padrões de Churn/Upsell aprendidos no treinamento.`,
    janelasDeOportunidade: [
      "Aproveitar a conversa neutra pra fortalecer o relacionamento e mapear necessidades futuras.",
      "Investigar ativamente se há dores que o cliente não verbalizou diretamente (a IA generativa ajuda nisso).",
      "Agendar um follow-up de rotina pra manter o relacionamento aquecido.",
    ],
  };
}

function preverComRegressaoLogistica(vetor: number[], m: ModeloExportado): ClassificacaoML {
  const scores = m.classes.map((_, c) => {
    let s = m.intercept[c];
    const linhaCoef = m.coef[c];
    for (let i = 0; i < vetor.length; i++) {
      s += vetor[i] * linhaCoef[i];
    }
    return s;
  });

  const maiorScore = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - maiorScore));
  const somaExps = exps.reduce((a, b) => a + b, 0);
  const probs = exps.map((e) => e / somaExps);

  let melhorIndice = 0;
  for (let i = 1; i < probs.length; i++) {
    if (probs[i] > probs[melhorIndice]) melhorIndice = i;
  }

  const probabilidades = {} as Record<SinalNegocio, number>;
  m.classes.forEach((classe, i) => {
    probabilidades[classe] = Number(probs[i].toFixed(4));
  });

  const sinalPrevisto = m.classes[melhorIndice];
  const confianca = Number(probs[melhorIndice].toFixed(4));
  const termos = sinalPrevisto === "NEUTRO" ? [] : termosInfluentes(vetor, m, melhorIndice);
  const { motivo, janelasDeOportunidade } = montarExplicacao(sinalPrevisto, termos, confianca);

  return {
    sinal: sinalPrevisto,
    confianca,
    probabilidades,
    termosChave: termos,
    motivo,
    janelasDeOportunidade,
  };
}

// classificação via modelo clássico de Machine Learning (TF-IDF + Regressão Logística),
// treinado nos dados reais do desafio de Data Science da equipe. Roda em paralelo
// com a análise por IA generativa (OpenAI) - são duas abordagens diferentes pro mesmo problema.
export function classificarComML(transcricao: string): ClassificacaoML {
  const m = carregarModelo();
  const textoLimpo = limparTranscricao(transcricao);
  const textoFinal = removerStopwords(textoLimpo);
  const tokens = tokenizar(textoFinal);
  const vetor = vetorizarTfidf(tokens, m);
  return preverComRegressaoLogistica(vetor, m);
}
