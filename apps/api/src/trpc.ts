import { initTRPC } from '@trpc/server';
import type { Db } from '@capsule/db';

// Request context. `getDb` is lazy so unauthenticated/no-DB routes (health) work
// without a database connection. Auth (Supabase user, kiosk station_id) lands here later.
export type Context = {
  getDb: () => Db;
  userId: string | null;
  stationId: number | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
