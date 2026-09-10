import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(process.cwd(), "..", ".env") });
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5000),
  clientUrl: process.env.CLIENT_URL ?? "http://localhost:5173",

  mongodbUri: required("MONGODB_URI", "mongodb://127.0.0.1:27017/mplad_insight"),

  jwtSecret: required("JWT_SECRET", "dev-only-insecure-secret-change-me"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "7d",

  astraApiKey: process.env.ASTRA_API_KEY ?? "",
  astraApiUrl: process.env.ASTRA_API_URL ?? "",
  astraModel: process.env.ASTRA_MODEL ?? "",

  uploadDir: process.env.UPLOAD_DIR ?? "uploads",
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB ?? 10),
};

export const isAstraConfigured = (): boolean =>
  Boolean(env.astraApiKey && env.astraApiUrl && env.astraModel);
