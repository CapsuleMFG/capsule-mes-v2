import { helloInput, ROLES } from '@capsule/shared';
import { router, publicProcedure } from './trpc';
import { productLinesRouter, stationsRouter, routesRouter } from './routers/reference';
import { jobsRouter, unitsRouter, shipmentsRouter } from './routers/production';

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

  productLines: productLinesRouter,
  stations: stationsRouter,
  routes: routesRouter,
  jobs: jobsRouter,
  units: unitsRouter,
  shipments: shipmentsRouter,
});

// Exported for the web client's type inference (type-only import — no runtime coupling).
export type AppRouter = typeof appRouter;
