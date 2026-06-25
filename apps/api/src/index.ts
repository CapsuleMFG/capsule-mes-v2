import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './router';
import { initDb } from './db';
import { seedIfEmpty } from './seed';
import type { Context } from './trpc';

const { db, mode } = await initDb();
if (mode === 'pglite-dev') {
  await seedIfEmpty(db);
  // eslint-disable-next-line no-console
  console.log('No DATABASE_URL — using in-memory PGlite dev DB (seeded demo data).');
}

const app = new Hono();

app.use('/*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));

app.get('/health', (c) => c.json({ ok: true, mode }));

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (): Context => ({ getDb: () => db, userId: null, stationId: null }),
  })
);

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`Capsule MES v2 API listening on http://localhost:${port} (db: ${mode})`);
