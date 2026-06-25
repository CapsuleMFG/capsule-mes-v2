import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import * as schema from './schema';

/**
 * Create an ephemeral, in-process Postgres (PGlite) with all migrations applied.
 * For tests and local experimentation — no external database required.
 */
export async function createTestDb() {
  const client = new PGlite();
  const db = drizzle(client, { schema });
  const migrationsFolder = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    '../migrations'
  );
  await migrate(db, { migrationsFolder });
  return db;
}
