import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trpcServer } from '@hono/trpc-server';
import { appRouter } from './router';
import { getDb } from './context';
import type { Context } from './trpc';

const app = new Hono();

app.use('/*', cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173' }));

app.get('/health', (c) => c.json({ ok: true }));

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (): Context => ({ getDb, userId: null, stationId: null }),
  })
);

const port = Number(process.env.API_PORT ?? 3001);
serve({ fetch: app.fetch, port });
// eslint-disable-next-line no-console
console.log(`Capsule MES v2 API listening on http://localhost:${port}`);
