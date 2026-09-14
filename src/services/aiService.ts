import OpenAI from "openai";
import { env } from "../config/env";
import { atendentes } from "../data/atendentes";
import { AnaliseTexto, EntradaAnalise, Urgencia } from "../types";

const vocabularioTracos = Array.from(
  new Set(atendentes.flatMap((a) => a.tracos))
).sort();

const client = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

function montarPrompt(entrada: EntradaAnalise): string {
  return `Voce e o motor de IA do SellerFit, um sistema usado por vendedores da TOTVS logo apos uma reuniao comercial.

Analise a transcricao abaixo e devolva SOMENTE um JSON valido, sem nenhum texto fora do JSON, seguindo exatamente este formato:

{
  "dores": ["dor 1 identificada", "dor 2 identificada", ...],
  "urgencia": "BAIXA" | "MEDIA" | "ALTA",
  "resumoPerfil": "resumo curto (2-3 frases) do perfil e prioridades do cliente",
  "tracosRecomendados": ["traco1", "traco2", ...],
  "segmentoDetectado": "segmento de mercado do cliente, uma palavra",
  "sentimentoGeral": "positivo" | "neutro" | "negativo" | "frustrado" | "animado"
}

Regras importantes:
- "dores" deve incluir tanto as dores ditas explicitamente quanto dores/necessidades que o cliente deu a entender mas nao falou diretamente (entrelinhas). Liste de 2 a 6 itens curtos.
- "urgencia" reflete o quanto essa dor esta afetando o negocio do cliente agora.
- "tracosRecomendados" deve conter de 2 a 4 palavras escolhidas OBRIGATORIAMENTE dessa lista de tracos comportamentais (escreva exatamente como esta na lista): ${vocabularioTracos.join(", ")}.
  Escolha os tracos do atendente ideal para lidar com esse cliente especifico, considerando o jeito dele falar e o tipo de dor.
- "segmentoDetectado" deve ser baseado no segmento informado (${entrada.segmento || "nao informado"}) e/ou no que aparecer na transcricao.

Dados da reuniao:
Cliente: ${entrada.clienteNome || "nao informado"}
Empresa: ${entrada.empresa || "nao informado"}
Segmento informado: ${entrada.segmento || "nao informado"}

Transcricao da reuniao:
"""
${entrada.transcricao}
"""`;
}

function normalizarUrgencia(valor: unknown): Urgencia {
  const v = String(valor || "").toUpperCase();
  if (v === "ALTA" || v === "MEDIA" || v === "BAIXA") return v;
  return "MEDIA";
}

async function analisarComOpenAI(entrada: EntradaAnalise): Promise<AnaliseTexto> {
  if (!client) {
    throw new Error("OPENAI_API_KEY nao configurada");
  }

  const resposta = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Voce e um analista de CRM especialista em identificar dores de clientes em reunioes comerciais. Responda sempre em portugues do Brasil e sempre em JSON valido.",
      },
      { role: "user", content: montarPrompt(entrada) },
    ],
  });

  const conteudo = resposta.choices[0]?.message?.content;
  if (!conteudo) throw new Error("Resposta vazia da OpenAI");

  const json = JSON.parse(conteudo);

  return {
    dores: Array.isArray(json.dores) && json.dores.length > 0 ? json.dores : ["nenhuma dor identificada"],
    urgencia: normalizarUrgencia(json.urgencia),
    resumoPerfil: json.resumoPerfil || "Nao foi possivel gerar um resumo.",
    tracosRecomendados: Array.isArray(json.tracosRecomendados) ? json.tracosRecomendados : [],
    segmentoDetectado: json.segmentoDetectado || entrada.segmento || "geral",
    sentimentoGeral: json.sentimentoGeral || "neutro",
    origemAnalise: "openai",
  };
}

// motor local usado quando a chave da OpenAI nao esta configurada ou a chamada falha
// (evita que a demonstracao trave por falta de credito/instabilidade de rede)
const PALAVRAS_DOR: Record<string, string> = {
  lento: "sistema lento no dia a dia",
  travando: "instabilidade / travamentos frequentes",
  confuso: "interface ou processo confuso",
  manual: "processos manuais que poderiam ser automatizados",
  caro: "percepcao de custo alto",
  "perde tempo": "perda de tempo em tarefas repetitivas",
  suporte: "insatisfacao com o suporte atual",
  planilha: "dependencia de planilhas paralelas",
  atraso: "atrasos em entregas ou processos",
  dificil: "dificuldade de uso do sistema atual",
  integra: "falta de integracao entre sistemas",
  retrabalho: "retrabalho por falha de processo",
};

function analisarLocal(entrada: EntradaAnalise): AnaliseTexto {
  const texto = entrada.transcricao.toLowerCase();

  const doresEncontradas = Object.entries(PALAVRAS_DOR)
    .filter(([chave]) => texto.includes(chave))
    .map(([, descricao]) => descricao);

  const dores = doresEncontradas.length > 0 ? doresEncontradas : ["nenhuma dor explicita identificada"];

  const urgencia: Urgencia = dores.length >= 3 ? "ALTA" : dores.length >= 1 && doresEncontradas.length > 0 ? "MEDIA" : "BAIXA";

  const tracosRecomendados: string[] = [];
  if (texto.includes("rapido") || texto.includes("urgente")) tracosRecomendados.push("agil");
  if (texto.includes("confuso") || texto.includes("entender")) tracosRecomendados.push("didatico");
  if (texto.includes("caro") || texto.includes("orcamento")) tracosRecomendados.push("negociadora");
  if (texto.includes("tecnico") || texto.includes("sistema") || texto.includes("integra")) tracosRecomendados.push("tecnico");
  if (texto.includes("expandir") || texto.includes("investir") || texto.includes("contratar") || texto.includes("crescer"))
    tracosRecomendados.push("estrategico", "negociadora");
  if (texto.includes("automatizar") || texto.includes("modernizar") || texto.includes("upgrade"))
    tracosRecomendados.push("estrategico");
  if (tracosRecomendados.length === 0) tracosRecomendados.push("comunicativa", "resolutivo");

  return {
    dores,
    urgencia,
    resumoPerfil: `Cliente da empresa ${entrada.empresa || "nao informada"}, segmento ${
      entrada.segmento || "nao informado"
    }. Analise gerada pelo motor local com base em palavras-chave da transcricao.`,
    tracosRecomendados,
    segmentoDetectado: entrada.segmento || "geral",
    sentimentoGeral: doresEncontradas.length >= 3 ? "frustrado" : doresEncontradas.length > 0 ? "neutro" : "positivo",
    origemAnalise: "motor-local",
  };
}

export async function analisarTranscricao(entrada: EntradaAnalise): Promise<AnaliseTexto> {
  if (!client) {
    return analisarLocal(entrada);
  }

  try {
    return await analisarComOpenAI(entrada);
  } catch (erro) {
    console.error("Falha ao chamar a OpenAI, usando motor local:", erro);
    return analisarLocal(entrada);
  }
}
