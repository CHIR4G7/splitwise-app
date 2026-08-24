# SplitIt

Group expense-splitting PWA. Create or join a group by invite link, log shared expenses against
categories, split them among chosen members, and track balances.

Planning doc: [`docs/implementation-plan.md`](docs/implementation-plan.md)

## Stack

React 19 + TypeScript + Vite + Tailwind, TanStack Query, React Router. Supabase (Postgres, Auth,
RLS) for the backend.

## Setup

```bash
npm install
cp .env.example .env   # fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

## Database

Migrations live in `supabase/migrations`. To apply them to a linked Supabase project:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

## Status

**Phases 0–3 complete.**

- Auth (signup/login/reset), profiles, group CRUD, invite links with expiry + revoke, member
  management, full schema with row-level security
- Expenses with four split methods (equal, exact, percent, shares), global + per-group custom
  categories, filtering by category/member/date range
- Live balances, greedy debt simplification, and settle-up
- Google OAuth alongside email/password
- Personal insights: cross-group share for any date range, broken down by category, group, and
  month, with charts

PWA offline polish (phase 4) is next.

Chart marks use `chart.DEFAULT` (#0d9488), not the brand ramp — the brand teal sits below the
chroma floor against a white chart surface and reads gray as a fill. `/dev/charts` renders the
chart components against sample data; it is `import.meta.env.DEV`-gated and tree-shaken out of
production builds.

### Conventions worth knowing

Money is stored as **integers in minor units** (paise/cents) everywhere — never floats. Splits use
largest-remainder apportionment (`src/lib/money.ts`) so parts always sum to the total exactly.

Writes that must be atomic go through `security definer` RPCs rather than PostgREST table writes.
This is not stylistic: Postgres applies SELECT policies to `RETURNING` rows, so `insert().select()`
returns 403 whenever the select policy depends on a row a trigger hasn't written yet.
