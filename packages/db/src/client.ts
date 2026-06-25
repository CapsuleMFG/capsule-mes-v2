import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

export function createDb(connectionString: string) {
  const pool = new Pool({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
  return drizzle(pool, { schema });
}

export type Db = ReturnType<typeof createDb>;
