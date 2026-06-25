import { asc } from 'drizzle-orm';
import * as s from '@capsule/db';
import { createProductLineInput, createStationInput, createRouteInput } from '@capsule/shared';
import { router, publicProcedure } from '../trpc';

export const productLinesRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(s.productLines).orderBy(asc(s.productLines.id))
  ),
  create: publicProcedure.input(createProductLineInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx.getDb().insert(s.productLines).values({ name: input.name }).returning();
    return row;
  }),
});

export const stationsRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(s.stations).orderBy(asc(s.stations.id))
  ),
  create: publicProcedure.input(createStationInput).mutation(async ({ ctx, input }) => {
    const [row] = await ctx
      .getDb()
      .insert(s.stations)
      .values({ name: input.name, productLineId: input.productLineId ?? null })
      .returning();
    return row;
  }),
});

export const routesRouter = router({
  list: publicProcedure.query(async ({ ctx }) => {
    const db = ctx.getDb();
    const routeRows = await db.select().from(s.routes).orderBy(asc(s.routes.id));
    const stepRows = await db.select().from(s.routeSteps).orderBy(asc(s.routeSteps.stepOrder));
    return routeRows.map((r) => ({ ...r, steps: stepRows.filter((st) => st.routeId === r.id) }));
  }),
  create: publicProcedure.input(createRouteInput).mutation(async ({ ctx, input }) => {
    const db = ctx.getDb();
    const [route] = await db
      .insert(s.routes)
      .values({ productLineId: input.productLineId, name: input.name })
      .returning();
    let order = 1;
    for (const stationId of input.stationIds) {
      await db.insert(s.routeSteps).values({ routeId: route.id, stepOrder: order++, stationId });
    }
    return route;
  }),
});
