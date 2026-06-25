import { z } from 'zod';

// Single source of truth for domain enums/types shared by client and server.

export const ROLES = ['admin', 'manager', 'engineer', 'supply_chain', 'operator'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const UNIT_STATUSES = ['in_process', 'done', 'shipped', 'scrapped'] as const;
export const JOB_STATUSES = ['open', 'in_progress', 'shipped', 'closed'] as const;

export const helloInput = z.object({ name: z.string().min(1).max(80) });
export type HelloInput = z.infer<typeof helloInput>;

// ── Phase 1 spine inputs ─────────────────────────────────────────────────────

export const idInput = z.object({ id: z.number().int().positive() });

export const createProductLineInput = z.object({
  name: z.string().min(1).max(80),
});

export const createStationInput = z.object({
  name: z.string().min(1).max(80),
  productLineId: z.number().int().positive().nullable().optional(),
});

export const createRouteInput = z.object({
  productLineId: z.number().int().positive(),
  name: z.string().min(1).max(80),
  // ordered station sequence — defines the route's steps
  stationIds: z.array(z.number().int().positive()).min(1),
});

export const createJobInput = z.object({
  productLineId: z.number().int().positive(),
  routeId: z.number().int().positive(),
  customer: z.string().max(120).optional(),
  quantity: z.number().int().min(1).max(1000),
});

export const advanceUnitInput = z.object({
  unitId: z.number().int().positive(),
  note: z.string().max(280).optional(),
});

export const shipUnitsInput = z.object({
  unitIds: z.array(z.number().int().positive()).min(1),
  carrier: z.string().max(80).optional(),
  trackingNumber: z.string().max(120).optional(),
});
