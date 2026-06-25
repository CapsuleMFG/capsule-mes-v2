import { helloInput, ROLES } from '@capsule/shared';
import { router, publicProcedure } from './trpc';

export const appRouter = router({
  health: publicProcedure.query(() => ({
    ok: true,
    service: 'capsule-mes-api',
    ts: new Date().toISOString(),
  })),

  hello: publicProcedure.input(helloInput).query(({ input }) => ({
    message: `Hello, ${input.name} — Capsule MES v2`,
  })),

  roles: publicProcedure.query(() => ROLES),
});

// Exported for the web client's type inference (type-only import — no runtime coupling).
export type AppRouter = typeof appRouter;
