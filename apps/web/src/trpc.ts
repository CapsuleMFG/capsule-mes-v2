import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@capsule/api';

export const trpc = createTRPCReact<AppRouter>();
