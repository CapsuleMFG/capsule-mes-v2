import { createDb, type Db } from '@capsule/db';

/**
 * Resolve the database connection.
 * - DATABASE_URL set  → real Postgres (Supabase) via node-postgres.
 * - DATABASE_URL unset → ephemeral in-memory PGlite with migrations applied,
 *   so `pnpm dev` runs the whole stack with zero external setup (dev only).
 */
export async function initDb(): Promise<{ db: Db; mode: 'postgres' | 'pglite-dev' }> {
  const url = process.env.DATABASE_URL;
  if (url) {
    return { db: createDb(url), mode: 'postgres' };
  }
  const { createTestDb } = await import('@capsule/db/testing');
  const db = (await createTestDb()) as unknown as Db;
  return { db, mode: 'pglite-dev' };
}
