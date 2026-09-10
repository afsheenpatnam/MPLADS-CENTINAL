/**
 * Jest setupFiles entry — runs before any test module (including config/env.ts) is imported.
 * Forces Astra to appear "unconfigured" during tests regardless of what's in the developer's
 * local server/.env, so tests stay deterministic and never make real network calls to a real
 * LLM provider. dotenv only fills in variables that are NOT already present in process.env, so
 * setting these to "" here (before env.ts's dotenv.config() calls run) wins.
 */
process.env.ASTRA_API_KEY = "";
process.env.ASTRA_API_URL = "";
process.env.ASTRA_MODEL = "";
