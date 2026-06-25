import { and, asc, eq, getTableColumns, gt, inArray, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import * as s from '@capsule/db';
import { advanceUnitInput, createJobInput, idInput, shipUnitsInput } from '@capsule/shared';
import { router, publicProcedure } from '../trpc';

export const jobsRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(s.jobs).orderBy(asc(s.jobs.id))
  ),

  get: publicProcedure.input(idInput).query(async ({ ctx, input }) => {
    const db = ctx.getDb();
    const [job] = await db.select().from(s.jobs).where(eq(s.jobs.id, input.id));
    if (!job) throw new TRPCError({ code: 'NOT_FOUND', message: 'Job not found' });
    const unitRows = await db
      .select({ ...getTableColumns(s.units), currentStationName: s.stations.name })
      .from(s.units)
      .leftJoin(s.routeSteps, eq(s.routeSteps.id, s.units.currentStepId))
      .leftJoin(s.stations, eq(s.stations.id, s.routeSteps.stationId))
      .where(eq(s.units.jobId, input.id))
      .orderBy(asc(s.units.id));
    return { job, units: unitRows };
  }),

  // Creating a job spawns one unit per quantity, placed on the route's first step.
  create: publicProcedure.input(createJobInput).mutation(async ({ ctx, input }) => {
    const db = ctx.getDb();

    const [route] = await db.select().from(s.routes).where(eq(s.routes.id, input.routeId));
    if (!route || route.productLineId !== input.productLineId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Route does not belong to that product line' });
    }
    const steps = await db
      .select()
      .from(s.routeSteps)
      .where(eq(s.routeSteps.routeId, input.routeId))
      .orderBy(asc(s.routeSteps.stepOrder));
    if (steps.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Route has no steps' });
    }
    const firstStep = steps[0];

    const [{ c }] = await db.select({ c: sql<number>`count(*)` }).from(s.jobs);
    const jobNumber = `CAP-${new Date().getFullYear()}-${String(Number(c) + 1).padStart(3, '0')}`;

    const [job] = await db
      .insert(s.jobs)
      .values({
        jobNumber,
        productLineId: input.productLineId,
        routeId: input.routeId,
        customer: input.customer ?? null,
        status: 'in_progress',
      })
      .returning();

    const created = [];
    for (let i = 0; i < input.quantity; i++) {
      const serial = `${jobNumber}-${String(i + 1).padStart(3, '0')}`;
      const [unit] = await db
        .insert(s.units)
        .values({
          jobId: job.id,
          productLineId: input.productLineId,
          routeId: input.routeId,
          currentStepId: firstStep.id,
          serial,
          status: 'in_process',
        })
        .returning();
      await db.insert(s.unitEvents).values({
        unitId: unit.id,
        type: 'created',
        toStepId: firstStep.id,
        stationId: firstStep.stationId,
      });
      created.push(unit);
    }

    return { job, units: created };
  }),
});

export const unitsRouter = router({
  events: publicProcedure.input(idInput).query(({ ctx, input }) =>
    ctx
      .getDb()
      .select()
      .from(s.unitEvents)
      .where(eq(s.unitEvents.unitId, input.id))
      .orderBy(asc(s.unitEvents.id))
  ),

  // Advance a unit to the next route step (or complete it if it's on the last step).
  advance: publicProcedure.input(advanceUnitInput).mutation(async ({ ctx, input }) => {
    const db = ctx.getDb();
    const [unit] = await db.select().from(s.units).where(eq(s.units.id, input.unitId));
    if (!unit) throw new TRPCError({ code: 'NOT_FOUND', message: 'Unit not found' });
    if (unit.status !== 'in_process') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: `Unit is ${unit.status}, cannot advance` });
    }
    if (!unit.currentStepId) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Unit is not on a step' });
    }

    const [curStep] = await db.select().from(s.routeSteps).where(eq(s.routeSteps.id, unit.currentStepId));
    if (!curStep) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Current step missing' });

    const [nextStep] = await db
      .select()
      .from(s.routeSteps)
      .where(and(eq(s.routeSteps.routeId, unit.routeId), gt(s.routeSteps.stepOrder, curStep.stepOrder)))
      .orderBy(asc(s.routeSteps.stepOrder))
      .limit(1);

    if (nextStep) {
      await db.update(s.units).set({ currentStepId: nextStep.id }).where(eq(s.units.id, unit.id));
      await db.insert(s.unitEvents).values({
        unitId: unit.id,
        type: 'advanced',
        fromStepId: curStep.id,
        toStepId: nextStep.id,
        stationId: nextStep.stationId,
        note: input.note ?? null,
      });
      return { ...unit, currentStepId: nextStep.id };
    }

    // No next step → unit is finished.
    await db.update(s.units).set({ currentStepId: null, status: 'done' }).where(eq(s.units.id, unit.id));
    await db.insert(s.unitEvents).values({
      unitId: unit.id,
      type: 'completed',
      fromStepId: curStep.id,
      stationId: curStep.stationId,
      note: input.note ?? null,
    });
    return { ...unit, currentStepId: null, status: 'done' as const };
  }),
});

export const shipmentsRouter = router({
  list: publicProcedure.query(({ ctx }) =>
    ctx.getDb().select().from(s.shipments).orderBy(asc(s.shipments.id))
  ),

  // Ship one or more finished units (must belong to a single job).
  ship: publicProcedure.input(shipUnitsInput).mutation(async ({ ctx, input }) => {
    const db = ctx.getDb();
    const unitRows = await db.select().from(s.units).where(inArray(s.units.id, input.unitIds));
    if (unitRows.length !== input.unitIds.length) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Some units were not found' });
    }
    const jobIds = [...new Set(unitRows.map((u) => u.jobId))];
    if (jobIds.length !== 1) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Units must belong to a single job' });
    }
    const notDone = unitRows.filter((u) => u.status !== 'done');
    if (notDone.length > 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'All units must be done before shipping' });
    }

    const [shipment] = await db
      .insert(s.shipments)
      .values({
        jobId: jobIds[0],
        status: 'shipped',
        carrier: input.carrier ?? null,
        trackingNumber: input.trackingNumber ?? null,
      })
      .returning();

    for (const u of unitRows) {
      await db.insert(s.shipmentItems).values({ shipmentId: shipment.id, unitId: u.id });
      await db.update(s.units).set({ status: 'shipped' }).where(eq(s.units.id, u.id));
      await db.insert(s.unitEvents).values({ unitId: u.id, type: 'shipped' });
    }

    return shipment;
  }),
});
