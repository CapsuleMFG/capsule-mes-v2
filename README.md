# Capsule MES v2

Fresh, typed-monorepo rebuild of the Capsule manufacturing execution system.
Design brief: see `CAPSULE-MES-V2-KICKOFF.md` (drop it in here from the planning session).

## Stack

- **Monorepo:** pnpm workspaces
- **web** (`apps/web`): Vite + React 19 + TypeScript + Tailwind + TanStack Query + tRPC client
- **api** (`apps/api`): Hono + tRPC server (+ Supabase auth — stubbed in Phase 0)
- **db** (`packages/db`): Drizzle ORM schema + `drizzle-kit` migrations (Supabase Postgres)
- **shared** (`packages/shared`): Zod schemas + shared types (single source of truth)

## Getting started

```bash
pnpm install
cp .env.example .env   # fill in DATABASE_URL etc. (use a FRESH Supabase project for v2)

pnpm dev               # runs api (:3001) + web (:5173) in parallel
pnpm typecheck         # typecheck all packages
pnpm build             # build web
pnpm db:generate       # generate a SQL migration from the Drizzle schema
pnpm db:migrate        # apply migrations (only against a v2 database)
```

## Layout

```
apps/web        React SPA
apps/api        Hono + tRPC API
packages/db     Drizzle schema + migrations
packages/shared Zod schemas + shared types
```

## Status: Phase 0 skeleton

Monorepo wired end-to-end: web calls a tRPC `health`/`hello` procedure on the api, types
flow from server to client, Drizzle schema + migration generation works. Auth, the real
data model, and features come next — see the kickoff brief's build order.
