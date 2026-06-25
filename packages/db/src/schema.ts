import { pgTable, serial, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

// Phase 0 starter slice of the v2 model. Grow this per the kickoff brief's data model
// (units, routes/route_steps, machines, bom_lines, shipments, profiles, events, ...).

export const productLines = pgTable('product_lines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const stations = pgTable('stations', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  // null = shared across product lines (the "a mix" decision)
  productLineId: integer('product_line_id').references(() => productLines.id),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
