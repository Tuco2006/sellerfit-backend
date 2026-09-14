import cors from "cors";
import express from "express";
import { env } from "./config/env";
import { analiseRouter } from "./routes/analise.routes";
import { atendentesRouter } from "./routes/atendentes.routes";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  })
);
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", ia: env.openaiApiKey ? "openai" : "motor-local" });
});

app.use("/api/atendentes", atendentesRouter);
app.use("/api/analises", analiseRouter);

app.use((_req, res) => {
  res.status(404).json({ erro: "rota nao encontrada" });
});

app.listen(env.port, () => {
  console.log(`SellerFit backend rodando na porta ${env.port}`);
  console.log(`Modo de IA: ${env.openaiApiKey ? "OpenAI" : "motor local (sem chave configurada)"}`);
});
