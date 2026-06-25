import { asc, eq } from 'drizzle-orm';
import * as s from '@capsule/db';
import type { Db } from '@capsule/db';

// Seed a demo product line, route, and an in-progress job — only if the DB is empty.
// Used for the zero-config PGlite dev database so the UI has something to show.
export async function seedIfEmpty(db: Db): Promise<void> {
  const existing = await db.select().from(s.productLines).limit(1);
  if (existing.length > 0) return;

  const [line] = await db.insert(s.productLines).values({ name: 'Pods' }).returning();

  const stationRows = [];
  for (const name of ['Cut', 'Weld', 'Assembly', 'QC']) {
    const [st] = await db.insert(s.stations).values({ name, productLineId: line.id }).returning();
    stationRows.push(st);
  }

  const [route] = await db
    .insert(s.routes)
    .values({ productLineId: line.id, name: 'Pod Route' })
    .returning();
  let order = 1;
  for (const st of stationRows) {
    await db.insert(s.routeSteps).values({ routeId: route.id, stepOrder: order++, stationId: st.id });
  }

  const [firstStep] = await db
    .select()
    .from(s.routeSteps)
    .where(eq(s.routeSteps.routeId, route.id))
    .orderBy(asc(s.routeSteps.stepOrder))
    .limit(1);

  const jobNumber = `CAP-${new Date().getFullYear()}-001`;
  const [job] = await db
    .insert(s.jobs)
    .values({
      jobNumber,
      productLineId: line.id,
      routeId: route.id,
      customer: 'Lennar',
      status: 'in_progress',
    })
    .returning();

  for (let i = 1; i <= 4; i++) {
    const [unit] = await db
      .insert(s.units)
      .values({
        jobId: job.id,
        productLineId: line.id,
        routeId: route.id,
        currentStepId: firstStep.id,
        serial: `${jobNumber}-${String(i).padStart(3, '0')}`,
        status: 'in_process',
      })
      .returning();
    await db.insert(s.unitEvents).values({
      unitId: unit.id,
      type: 'created',
      toStepId: firstStep.id,
      stationId: firstStep.stationId,
    });
  }
}
