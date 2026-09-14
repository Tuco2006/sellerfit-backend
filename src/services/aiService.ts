import OpenAI from "openai";
import { env } from "../config/env";
import { atendentes } from "../data/atendentes";
import { AnaliseTexto, EntradaAnalise, Urgencia } from "../types";

const vocabularioTracos = Array.from(
  new Set(atendentes.flatMap((a) => a.tracos))
).sort();

const idsAtendentesValidos = new Set(atendentes.map((a) => a.id));

const catalogoAtendentes = atendentes
  .map(
    (a) =>
      `- id:${a.id} | nome:${a.nome} | cargo:${a.cargo} | tracos:${a.tracos.join(", ")} | segmentos:${a.segmentos.join(", ")} | foco:${a.foco.join(", ")} | nota:${a.notaMedia} | bio:${a.bio}`
  )
  .join("\n");

const client = env.openaiApiKey ? new OpenAI({ apiKey: env.openaiApiKey }) : null;

function montarPrompt(entrada: EntradaAnalise): string {
  return `Você é o motor de IA do SellerFit, um sistema usado por vendedores da TOTVS logo após uma reunião comercial.

Analise a transcrição abaixo e devolva SOMENTE um JSON válido, sem nenhum texto fora do JSON, seguindo exatamente este formato:

{
  "dores": ["dor 1 identificada", "dor 2 identificada", ...],
  "urgencia": "BAIXA" | "MÉDIA" | "ALTA",
  "resumoPerfil": "resumo curto (2-3 frases) do perfil e prioridades do cliente",
  "tracosRecomendados": ["traco1", "traco2", ...],
  "segmentoDetectado": "segmento de mercado do cliente, uma palavra",
  "sentimentoGeral": "positivo" | "neutro" | "negativo" | "frustrado" | "animado",
  "atendenteRecomendadoId": "id de UM atendente da lista abaixo",
  "justificativaAtendente": "2-3 frases explicando a escolha"
}

Regras importantes:
- "dores" deve incluir tanto as dores ditas explicitamente quanto dores/necessidades que o cliente deu a entender mas não falou diretamente (entrelinhas). Liste de 2 a 6 itens curtos.
- "urgencia" reflete o quanto essa dor está afetando o negócio do cliente agora.
- "tracosRecomendados" deve conter de 2 a 4 palavras escolhidas OBRIGATORIAMENTE dessa lista de traços comportamentais (escreva exatamente como está na lista): ${vocabularioTracos.join(", ")}.
  Escolha os traços do atendente ideal para lidar com esse cliente específico, considerando o jeito dele falar e o tipo de dor.
- "segmentoDetectado" deve ser baseado no segmento informado (${entrada.segmento || "não informado"}) e/ou no que aparecer na transcrição.
- "atendenteRecomendadoId" e "justificativaAtendente": esse é o ponto mais importante da análise. Leia com atenção o catálogo de atendentes abaixo (nome, cargo, traços, segmentos, foco, nota e bio de cada um) e escolha, com raciocínio de verdade, qual atendente específico tem o melhor encaixe pra esse cliente e essa conversa - não escolha só pelo segmento, considere o jeito de falar do cliente, a dor específica dele e o estilo/especialidade de cada atendente descrito na bio.
  Na justificativa, cite elementos concretos: algo que o cliente disse ou precisa, cruzado com algo específico do perfil ou da bio do atendente escolhido (não repita só os traços, mostre que você entendeu o motivo real do encaixe).
  O "atendenteRecomendadoId" TEM que ser exatamente um dos ids listados abaixo, sem inventar id novo.

Catálogo de atendentes disponíveis:
${catalogoAtendentes}

Dados da reunião:
Cliente: ${entrada.clienteNome || "não informado"}
Empresa: ${entrada.empresa || "não informado"}
Segmento informado: ${entrada.segmento || "não informado"}

Transcrição da reunião:
"""
${entrada.transcricao}
"""`;
}

function normalizarUrgencia(valor: unknown): Urgencia {
  const v = String(valor || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

  if (v === "ALTA") return "ALTA";
  if (v === "BAIXA") return "BAIXA";
  return "MÉDIA";
}

async function analisarComOpenAI(entrada: EntradaAnalise): Promise<AnaliseTexto> {
  if (!client) {
    throw new Error("OPENAI_API_KEY não configurada");
  }

  const resposta = await client.chat.completions.create({
    model: env.openaiModel,
    temperature: 0.4,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Você é um analista de CRM sênior, especialista em identificar dores de clientes em reuniões comerciais e em recomendar, com raciocínio real (não mecânico), qual atendente do time deve continuar cada atendimento. Responda sempre em português do Brasil e sempre em JSON válido.",
      },
      { role: "user", content: montarPrompt(entrada) },
    ],
  });

  const conteudo = resposta.choices[0]?.message?.content;
  if (!conteudo) throw new Error("Resposta vazia da OpenAI");

  const json = JSON.parse(conteudo);

  const atendenteRecomendadoId =
    typeof json.atendenteRecomendadoId === "string" && idsAtendentesValidos.has(json.atendenteRecomendadoId)
      ? json.atendenteRecomendadoId
      : undefined;

  return {
    dores: Array.isArray(json.dores) && json.dores.length > 0 ? json.dores : ["nenhuma dor identificada"],
    urgencia: normalizarUrgencia(json.urgencia),
    resumoPerfil: json.resumoPerfil || "Não foi possível gerar um resumo.",
    tracosRecomendados: Array.isArray(json.tracosRecomendados) ? json.tracosRecomendados : [],
    segmentoDetectado: json.segmentoDetectado || entrada.segmento || "geral",
    sentimentoGeral: json.sentimentoGeral || "neutro",
    origemAnalise: "openai",
    atendenteRecomendadoId,
    justificativaAtendente: atendenteRecomendadoId ? json.justificativaAtendente || undefined : undefined,
  };
}

// motor local usado quando a chave da OpenAI não está configurada ou a chamada falha
// (evita que a demonstração trave por falta de crédito/instabilidade de rede)
const PALAVRAS_DOR: Record<string, string> = {
  lento: "sistema lento no dia a dia",
  travando: "instabilidade / travamentos frequentes",
  confuso: "interface ou processo confuso",
  manual: "processos manuais que poderiam ser automatizados",
  caro: "percepção de custo alto",
  "perde tempo": "perda de tempo em tarefas repetitivas",
  suporte: "insatisfação com o suporte atual",
  planilha: "dependência de planilhas paralelas",
  atraso: "atrasos em entregas ou processos",
  dificil: "dificuldade de uso do sistema atual",
  integra: "falta de integração entre sistemas",
  retrabalho: "retrabalho por falha de processo",
};

function analisarLocal(entrada: EntradaAnalise): AnaliseTexto {
  const texto = entrada.transcricao.toLowerCase();

  const doresEncontradas = Object.entries(PALAVRAS_DOR)
    .filter(([chave]) => texto.includes(chave))
    .map(([, descricao]) => descricao);

  const dores = doresEncontradas.length > 0 ? doresEncontradas : ["nenhuma dor explícita identificada"];

  const urgencia: Urgencia = dores.length >= 3 ? "ALTA" : dores.length >= 1 && doresEncontradas.length > 0 ? "MÉDIA" : "BAIXA";

  const tracosRecomendados: string[] = [];
  if (texto.includes("rapido") || texto.includes("rápido") || texto.includes("urgente")) tracosRecomendados.push("ágil");
  if (texto.includes("confuso") || texto.includes("entender")) tracosRecomendados.push("didático");
  if (texto.includes("caro") || texto.includes("orcamento") || texto.includes("orçamento")) tracosRecomendados.push("negociadora");
  if (texto.includes("tecnico") || texto.includes("técnico") || texto.includes("sistema") || texto.includes("integra")) tracosRecomendados.push("técnico");
  if (texto.includes("expandir") || texto.includes("investir") || texto.includes("contratar") || texto.includes("crescer"))
    tracosRecomendados.push("estratégico", "negociadora");
  if (texto.includes("automatizar") || texto.includes("modernizar") || texto.includes("upgrade"))
    tracosRecomendados.push("estratégico");
  if (tracosRecomendados.length === 0) tracosRecomendados.push("comunicativa", "resolutivo");

  return {
    dores,
    urgencia,
    resumoPerfil: `Cliente da empresa ${entrada.empresa || "não informada"}, segmento ${
      entrada.segmento || "não informado"
    }. Análise gerada pelo motor local com base em palavras-chave da transcrição.`,
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
