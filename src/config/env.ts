import "dotenv/config";

export const env = {
  port: Number(process.env.PORT) || 3333,
  openaiApiKey: process.env.OPENAI_API_KEY || "",
  openaiModel: process.env.OPENAI_MODEL || "gpt-4o-mini",
  corsOrigin: (process.env.CORS_ORIGIN || "http://localhost:3000")
    .split(",")
    .map((origem) => origem.trim()),
};
