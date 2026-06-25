import { createDb, type Db } from '@capsule/db';

let cached: Db | null = null;

// Lazily create (and cache) the production database connection from DATABASE_URL.
// Only invoked when a procedure actually touches the DB.
export function getDb(): Db {
  if (!cached) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is not set — add it to .env (use a v2 Supabase database).');
    }
    cached = createDb(url);
  }
  return cached;
}
