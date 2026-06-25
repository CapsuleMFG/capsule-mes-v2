import { z } from 'zod';

// Single source of truth for domain enums/types shared by client and server.

export const ROLES = ['admin', 'manager', 'engineer', 'supply_chain', 'operator'] as const;
export const roleSchema = z.enum(ROLES);
export type Role = z.infer<typeof roleSchema>;

export const helloInput = z.object({
  name: z.string().min(1).max(80),
});
export type HelloInput = z.infer<typeof helloInput>;
