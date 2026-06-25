# Capsule MES v2 — Design & Kickoff Brief

> **How to use this doc:** This is the kickoff brief for a fresh, from-scratch build of the
> Capsule manufacturing execution system. It carries forward the *domain knowledge* and
> *hard lessons* from v1 while starting with clean architecture and a typed stack. Drop this
> file at the root of the new repo and give it to your coding session as context. It is a
> design target, not gospel — refine as you build.
>
> **Why a rewrite:** motivation, ownership, and quality. v1 is a working but accreted system
> (35 ad-hoc migrations, no migration tooling, denormalized stations, three overlapping BOM
> tables). v2 keeps what v1 *learned* and discards how it was *built*.

---

## 1. Product goal

A whole-company Manufacturing Execution System for a ~20-person shop. Tracks work
end-to-end:

**Engineering → Supply Chain → Production (stations / machines / units) → Shipping.**

It must be **generic across product lines** (pods and panels are two lines among several) —
nothing in the data model may hardcode a product type. Office staff log in with
email/password; floor operators authenticate at station kiosks by PIN.

---

## 2. Stack (chosen: typed monorepo)

Single repo, fully typed end-to-end, real migrations from commit one.

```
capsule-mes/
├── apps/
│   ├── web/          # Vite + React 19 + TypeScript + Tailwind
│   │                 #   TanStack Query (+ tRPC client), TanStack Router or React Router
│   └── api/          # Hono (recommended) or Express + tRPC server
│                     #   Supabase JWT verification middleware; kiosk PIN→JWT
├── packages/
│   ├── db/           # Drizzle ORM schema + drizzle-kit migrations (Postgres/Supabase)
│   ├── shared/       # Zod schemas + shared types (single source of truth)
│   └── config/       # tsconfig, eslint/biome, tailwind preset
└── package.json      # pnpm workspaces (+ optional Turborepo)
```

**Recommended specifics**
- **pnpm** workspaces (+ Turborepo if you want task caching).
- **Drizzle ORM + drizzle-kit** — typed schema, generated SQL migrations, `drizzle-kit push`/`migrate`. This is the direct fix for v1's single biggest gap (no migration tooling; schema built out-of-band).
- **tRPC** for client↔server calls — types flow from server to client with zero codegen. TanStack Query is the cache layer underneath.
- **Zod** schemas in `packages/shared`, reused for tRPC input validation *and* form validation.
- **Supabase** Postgres + Auth (keep — it's fine and already provisioned).
- **Hono** for the API (small, fast, great TS) — or Express if you'd rather stay familiar.
- **Vitest** for unit/integration; **Playwright** optional for e2e.
- TypeScript `strict`, Biome or ESLint+Prettier.

**Deployment:** API → Render (or Fly/Railway); web → Vercel. Use the Supabase **Session
pooler** connection string everywhere (see Lessons #6) and wire migrations into the deploy.

---

## 3. Data model v2 (the core — corrected from v1)

Principles: every "station" is a row, not a string; units are generic; one BOM model, not
three; product lines are first-class; the event log is deliberate.

### Reference / org
- **product_lines** — `id, name, is_active`. First-class from day one (v1 had none).
- **clients** — `id, name, contact, …`.
- **profiles** — `id (uuid → auth.users), name, role, pin, station_id?, is_active`.
  Roles: `admin | manager | engineer | supply_chain | operator` (decide the set up front and
  keep the DB CHECK in sync with code — see Lessons #4).

### Resources (physical)
- **stations** — `id, name (canonical, unique), product_line_id?(null = shared), is_active`.
  Canonical table from commit one. Everything references `station_id`, never a name string.
- **machines** — `id, name, type, station_id?, status, is_down, down_reason, …`.
  **Status-only** (manual flag). Leave a clean seam for telemetry later; do not build it now.

### Routing (per product line)
- **routes** — `id, product_line_id, name`. A product line defines its own station sequence.
- **route_steps** — `id, route_id, step_order, station_id, machine_id?, est_minutes`.
  Routing references `station_id` (FK), so renames never break scoping or queues.

### Work & units (the spine)
- **jobs** — `id, job_number, client_id, product_line_id, priority, status, dates, …`.
- **units** — the generic trackable thing (replaces v1's `tracked_parts`):
  `id, job_id, product_line_id, route_id, current_step_id?, status, identifier(QR/serial),
  parent_unit_id? (optional nesting — decide per line), …`. **Never** hardcode pod/panel.
  Do **not** denormalize a `current_station` string (v1 did, then queried a column that
  didn't even exist — see Lessons #3). Derive the current station via
  `current_step_id → route_steps.station_id`.
- *(Decide)* **work_orders** — in v1 a WO was "a batch released to the floor." Consider
  whether units + a lightweight `work_order` grouping (or just a `released_at` on a batch)
  replaces most of v1's WO machinery. Don't port WO complexity blindly.

### BOM & supply chain (collapse v1's THREE tables into one model)
v1 had `job_materials` (legacy), `bom_items` (engineering), and `pbom_items` (procurement) —
overlapping and confusing. v2:
- **bom_lines** — engineering's bill of materials: `id, job_id (or unit_id), part_number,
  description, qty, unit, material/specs, route_id?`. One source of truth.
- **procurement** layer references bom_lines: `purchase_orders`, `suppliers`,
  `inventory` (on-hand), with PO ↔ bom_line links and qty ordered/received/allocated.
  Reference QuickBooks for cost/accounting — don't rebuild it.

### Tracking, shipping, system
- **station_events** (and/or `unit_events`) — purpose-built, append-only logs of state
  changes (unit entered station, checked in/out, quality pass/fail, machine down). Prefer
  purpose-built logs + a unified read *view* over one polymorphic mega-table.
- **shipments** + **shipment_items** — shipment_items link **units** (unit-level from day
  one; v1 was job-level only). Carrier, tracking, status workflow.
- **audit_log** — generic CRUD trail. **notifications** — user-scoped.

> Build the schema in `packages/db` with Drizzle; every change is a checked-in migration.
> Seed data (product lines, stations, machines, a demo job) lives behind an explicit flag.

---

## 4. Auth & access

- **Supabase Auth** (email/password) for office; **kiosk PIN → signed JWT** for operators.
- Put **`station_id`** in the kiosk identity (not a name string). Operator scoping compares
  `station_id` to the unit's current step's `station_id` — eliminating v1's name-mismatch
  class of bug entirely.
- Decide **RLS vs app-layer** auth deliberately and once. App-layer (middleware/tRPC
  context) is simplest for ~20 users; if you use RLS, design the policy matrix up front.

---

## 5. Lessons from v1 — do NOT repeat these

1. **Migration tooling from commit one.** v1 had none; the schema was built out-of-band and
   drifted from the files on disk. Drizzle fixes this — never hand-edit prod schema.
2. **Canonical `stations` table, never free-text.** v1 stored station names as strings in
   two places that disagreed (`Welding Bay` vs `Welding`), silently breaking operator
   scoping and the queue.
3. **Don't denormalize derived state.** v1's `operatorScope` queried `tracked_parts.current_station`
   — a column that never existed — and 500'd for every operator. Derive station from the route step.
4. **Keep code ↔ DB constraints in sync.** v1's `profiles.role` CHECK allowed 4 roles while
   code used 5. Drizzle + one source of truth prevents this.
5. **Generic units.** No `pod`/`panel` anywhere in the schema or code. Type is data.
6. **Supabase connection + secrets hygiene.** Use the **Session pooler** URI
   (`postgres.<ref>@...pooler.supabase.com:5432`, tenant-qualified username) — the direct
   `db.<ref>.supabase.co` host is IPv6-only and fails from many hosts; a plain `postgres`
   username on the pooler fails auth (`28P01`). Set the same working URL in every
   environment (this exact misconfig took v1's prod down on Render).
7. **Tests around the state machine from the start** — unit status transitions, check-in/out,
   route-step dependency, scrap/recut. That's where a bug corrupts tracking.
8. **Decide product-line ↔ resource relationship up front:** confirmed **"a mix"** — some
   stations/machines shared, some dedicated. `stations.product_line_id` nullable (null =
   shared). Routing stays independent of physical resources.

---

## 6. Build order (vertical slice first)

1. **Phase 0 — skeleton.** Monorepo + pnpm + Drizzle + Supabase + auth (email login + one
   seeded admin) + tRPC hello-world + CI that runs typecheck/migrate/test. One real migration.
2. **Phase 1 — the spine (one product line).** Job → spawn units on that line's route → a unit
   moves through stations (writes station_events) → mark it shipped. Ugly is fine. Prove the
   spine end-to-end before generalizing.
3. **Phase 2 — operator kiosk.** PIN login (station_id identity), station queue, check-in/out,
   quality gates. Use the events the spine already writes.
4. **Phase 3 — engineering & BOM.** Jobs, bom_lines, route assignment. (Port v1's PDF/XLSX
   BOM parsing — see §7.)
5. **Phase 4 — supply chain.** Procurement, POs, suppliers, inventory; QuickBooks for cost.
6. **Phase 5 — scheduling & dashboards.** Machine queues, production board, KPIs.
7. **Phase 6 — shipping & reporting.** Unit-level shipments, on-time metrics, audit log viewer.

Widen to all product lines only after the single-line spine is solid.

---

## 7. What to carry from v1

- **Domain model & workflow** — this document is the distillation; the v1 repo is the
  reference when you need detail on a specific flow.
- **Port specific good code** (rewrite into the new stack, don't copy wholesale):
  - PDF work-order parsing + XLSX BOM import (`pdf-parse`, `xlsx`) — fiddly, worth lifting.
  - The kiosk PIN→JWT auth flow shape (re-implement cleanly with `station_id`).
  - The role/operator-scope *intent* (re-implement by `station_id`).
- **Design system:** treated as a **fresh-start opportunity** (not carried over). If you want
  a head start, v1's light "Soft Structural" theme (white cards, Geist, Phosphor icons) is in
  the old repo's `DESIGN_SYSTEM.md` — reuse or reinvent, your call.

---

## 8. Open questions to resolve early (cheap now, expensive later)

- The actual **product line list** (pods, panels, … what else?).
- **Unit nesting** per line — does a pod contain panels as sub-units? (sets `parent_unit_id`).
- **Work order** model — keep as an entity, or replace with unit batches + routing?
- **RLS vs app-layer** authorization.
- **Shipping as a workflow stage** vs a separate module.
- Visual design direction (keep light theme / go new).
