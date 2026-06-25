import { describe, it, expect } from 'vitest';
import { createTestDb } from '@capsule/db/testing';
import type { Db } from '@capsule/db';
import { appRouter } from '../src/router';

function caller(db: Db) {
  // PGlite's drizzle instance is API-compatible with the node-postgres one for the
  // operations these procedures use; cast keeps the context type honest.
  return appRouter.createCaller({ getDb: () => db, userId: null, stationId: null });
}

describe('Phase 1 spine', () => {
  it('job → units → advance through stations → ship', async () => {
    const db = (await createTestDb()) as unknown as Db;
    const trpc = caller(db);

    // Set up one product line with a 3-station route.
    const line = await trpc.productLines.create({ name: 'Pods' });
    const cut = await trpc.stations.create({ name: 'Cut', productLineId: line.id });
    const weld = await trpc.stations.create({ name: 'Weld', productLineId: line.id });
    const qc = await trpc.stations.create({ name: 'QC', productLineId: line.id });
    const route = await trpc.routes.create({
      productLineId: line.id,
      name: 'Pod Route',
      stationIds: [cut.id, weld.id, qc.id],
    });

    // Creating a job spawns units onto the first step.
    const { job, units } = await trpc.jobs.create({
      productLineId: line.id,
      routeId: route.id,
      customer: 'Lennar',
      quantity: 3,
    });
    expect(units).toHaveLength(3);
    expect(job.jobNumber).toMatch(/^CAP-\d{4}-\d{3}$/);
    expect(units[0].currentStepId).not.toBeNull();

    // Advance one unit through Cut → Weld → QC → done (3 steps = 3 advances).
    const u = units[0];
    await trpc.units.advance({ unitId: u.id });
    await trpc.units.advance({ unitId: u.id });
    const finished = await trpc.units.advance({ unitId: u.id });
    expect(finished.status).toBe('done');
    expect(finished.currentStepId).toBeNull();

    // Event trail: created + advanced + advanced + completed.
    const events = await trpc.units.events({ id: u.id });
    expect(events.map((e) => e.type)).toEqual(['created', 'advanced', 'advanced', 'completed']);

    // Cannot ship a unit that isn't done.
    await expect(trpc.shipments.ship({ unitIds: [units[1].id] })).rejects.toThrow();

    // Ship the finished unit.
    const shipment = await trpc.shipments.ship({ unitIds: [u.id], carrier: 'UPS' });
    expect(shipment.carrier).toBe('UPS');

    const detail = await trpc.jobs.get({ id: job.id });
    const shipped = detail.units.find((x) => x.id === u.id);
    expect(shipped?.status).toBe('shipped');
  });
});
