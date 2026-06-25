import { initTRPC } from '@trpc/server';

// Request context. Phase 0 is unauthenticated; later this resolves the Supabase
// user (and, for kiosk tokens, the operator's station_id) from the request.
export type Context = {
  userId: string | null;
  stationId: number | null;
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
