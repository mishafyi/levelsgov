import { Pool } from "pg";

const globalForPg = globalThis as typeof globalThis & { pgPool?: Pool };

const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgresql://localhost:5433/fedwork",
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  });

if (process.env.NODE_ENV !== "production") globalForPg.pgPool = pool;

export async function query<T extends Record<string, unknown>>(
  text: string,
  params?: (string | number | null)[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export default pool;
