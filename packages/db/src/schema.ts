import {
  pgTable,
  serial,
  text,
  boolean,
  integer,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

// ── Reference / org ──────────────────────────────────────────────────────────

export const productLines = pgTable('product_lines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Canonical stations — referenced by id everywhere (never free-text, per v1's lesson).
// product_line_id null = shared across lines (the "a mix" decision).
export const stations = pgTable('stations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  productLineId: integer('product_line_id').references(() => productLines.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Routing (per product line) ───────────────────────────────────────────────

export const routes = pgTable('routes', {
  id: serial('id').primaryKey(),
  productLineId: integer('product_line_id')
    .notNull()
    .references(() => productLines.id),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const routeSteps = pgTable(
  'route_steps',
  {
    id: serial('id').primaryKey(),
    routeId: integer('route_id')
      .notNull()
      .references(() => routes.id),
    stepOrder: integer('step_order').notNull(),
    stationId: integer('station_id')
      .notNull()
      .references(() => stations.id),
  },
  (t) => [uniqueIndex('route_steps_route_order_uq').on(t.routeId, t.stepOrder)]
);

// ── Work & units (the spine) ─────────────────────────────────────────────────

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  jobNumber: text('job_number').notNull().unique(),
  productLineId: integer('product_line_id')
    .notNull()
    .references(() => productLines.id),
  routeId: integer('route_id')
    .notNull()
    .references(() => routes.id),
  customer: text('customer'),
  // open | in_progress | shipped | closed
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// A unit is the generic trackable thing. No product-type hardcoding.
export const units = pgTable('units', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id')
    .notNull()
    .references(() => jobs.id),
  productLineId: integer('product_line_id')
    .notNull()
    .references(() => productLines.id),
  routeId: integer('route_id')
    .notNull()
    .references(() => routes.id),
  // Current station is DERIVED from this step — never denormalized (v1's bug).
  currentStepId: integer('current_step_id').references(() => routeSteps.id),
  serial: text('serial').notNull().unique(),
  // in_process | done | shipped | scrapped
  status: text('status').notNull().default('in_process'),
  // Optional nesting (pods containing panels) — FK self-ref deferred to a later phase.
  parentUnitId: integer('parent_unit_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// Append-only event log for a unit's journey.
export const unitEvents = pgTable('unit_events', {
  id: serial('id').primaryKey(),
  unitId: integer('unit_id')
    .notNull()
    .references(() => units.id),
  // created | advanced | completed | shipped | scrapped
  type: text('type').notNull(),
  fromStepId: integer('from_step_id').references(() => routeSteps.id),
  toStepId: integer('to_step_id').references(() => routeSteps.id),
  stationId: integer('station_id').references(() => stations.id),
  note: text('note'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

// ── Shipping (unit-level from day one) ───────────────────────────────────────

export const shipments = pgTable('shipments', {
  id: serial('id').primaryKey(),
  jobId: integer('job_id')
    .notNull()
    .references(() => jobs.id),
  // packed | shipped | delivered
  status: text('status').notNull().default('shipped'),
  carrier: text('carrier'),
  trackingNumber: text('tracking_number'),
  shippedAt: timestamp('shipped_at', { withTimezone: true }).notNull().defaultNow(),
});

export const shipmentItems = pgTable(
  'shipment_items',
  {
    id: serial('id').primaryKey(),
    shipmentId: integer('shipment_id')
      .notNull()
      .references(() => shipments.id),
    unitId: integer('unit_id')
      .notNull()
      .references(() => units.id),
  },
  (t) => [uniqueIndex('shipment_items_unit_uq').on(t.unitId)]
);
