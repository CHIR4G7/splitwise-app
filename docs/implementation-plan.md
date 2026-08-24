# SplitEase — Group Expense Splitting PWA
## Implementation Plan v1

A Splitwise-style progressive web app: users sign up, create or join groups via invite link, log shared expenses against categories, split them among chosen members by a chosen ratio, and track running balances. Includes a personal-expense view filterable by custom date ranges.

---

## 1. Feature List (MVP)

**Auth & Identity**
- Email/password signup & login (session via JWT)
- Password reset
- Profile: display name, avatar, default currency

**Groups**
- Create group (name, icon/emoji, default currency)
- Invite via shareable link (token-based, optional expiry / max-uses)
- Join group via invite link
- Member list, remove/leave group
- Multiple concurrent groups per user

**Expenses**
- Add expense: amount, description, category, paid-by (one or more payers), date, optional receipt photo
- Category picker: predefined list (Groceries, Travel, Rent, Sports, Utilities, Entertainment, Other) + user-defined custom categories per group
- Participant selection: choose subset of group members the expense applies to
- Split methods: **equal**, **exact amount**, **percentage**, **shares/weighted**
- Edit / delete expense (with balance recalculation)
- Comment/activity log on an expense (stretch)

**Balances & Settlement**
- Real-time per-member net balance within a group ("you owe" / "owed to you")
- Debt simplification ("settle up") — minimal set of suggested payments to zero out a group
- Manual "record a payment" / settle-up entry between two members

**Views & Reporting**
- Group overview: total spend, balances, recent activity
- Group expense history (filter by category, member, date range)
- Personal dashboard: my share of spend across all groups, filterable by custom date range, broken down by category
- Simple charts: spend-by-category, spend-over-time

**PWA**
- Installable (manifest + icons), offline shell, cached read-views, background sync for queued expense adds when offline

**Out of scope for v1** (noted for roadmap): multi-currency conversion, recurring expenses, push notifications, receipt OCR, third-party payment integration (UPI/PayPal settle links).

---

## 2. UI / Frontend Plan

**Stack:** React + TypeScript + Vite, Tailwind CSS, React Router, TanStack Query (server state/cache), Zustand or Context for local UI state, `vite-plugin-pwa` for manifest/service worker/offline caching.

**Screens**
| Screen | Purpose |
|---|---|
| Auth (Login / Signup / Reset) | Entry point |
| Groups Home | List of user's groups with net balance chip per group |
| Join via Invite | Deep-link landing (`/join/:token`) → preview group → confirm join |
| Group Detail — Overview | Balances tab: who-owes-whom, settle-up suggestions |
| Group Detail — Expenses | Chronological expense list, filters (category/member/date) |
| Add / Edit Expense | Amount, category, payer(s), participant picker, split-method selector with live preview of per-person shares |
| Settle Up | Confirm a payment between two members |
| Personal Insights | Cross-group date-range filter, category breakdown, my-share totals |
| Group Settings | Members, invite link, leave/delete group |
| Profile | Account details |

**Key UI mechanics**
- Split-method selector recomputes and previews per-person amounts live, blocking submit until shares reconcile to the total (down to the minor currency unit).
- Optimistic UI for adding expenses; reconcile against server response; queue-and-sync when offline.
- Mobile-first single-column layout; bottom nav (Groups / Insights / Profile).

---

## 3. Backend Architecture

**Recommendation: Supabase (Postgres + Auth + Realtime + Storage + Edge Functions).** Chirag's existing `store-app` monorepo already runs on Supabase — same operational pattern applies well here and keeps auth/session handling consistent with prior work, without implying this is the same project.

- **Auth:** Supabase Auth (email/password now; OAuth providers later) issuing JWTs; Postgres Row Level Security (RLS) scopes every table to `auth.uid()` and group membership.
- **API layer:** Supabase auto-generated REST/PostgREST for straightforward CRUD (groups, members, categories) + a small number of **Edge Functions** (Deno/TS) for logic that must be atomic or server-trusted:
  - `create_expense` — validates split reconciles to total, writes expense + participant shares in one transaction
  - `join_group` — validates invite token, expiry, max-uses, inserts membership
  - `settle_up` — records a settlement transaction
  - `simplify_debts` — computes minimal settlement suggestions for a group
- **Realtime:** Supabase Realtime channel per group so balance/expense changes push live to all open clients.
- **Storage:** Supabase Storage bucket for receipt images, referenced by URL on the expense row.
- **Business-logic placement:** monetary correctness (split reconciliation, balance math) lives in Edge Functions / Postgres functions, not the client — client only *previews* the split before submit.

---

## 4. Database: SQL (PostgreSQL) — no NoSQL/graph needed

This domain is inherently relational and money-correctness-sensitive:

- **ACID transactions** are required — creating an expense and its N participant shares must succeed or fail atomically, and share amounts must sum exactly to the total (in minor currency units). Document stores push that consistency burden onto application code; Postgres gives it for free via a transaction + `CHECK` constraint.
- **Strong foreign-key integrity** between users, groups, memberships, expenses, and shares is exactly what an RDBMS is for.
- **Aggregate queries** (balances, category breakdowns, date-range personal totals) are native `SUM`/`GROUP BY` operations — trivial in SQL, awkward and slower in a document DB unless heavily denormalized and kept in sync manually.
- **Graph DB (e.g. Neo4j)** was considered for the "who-owes-whom" debt network, since it's conceptually a graph. Rejected for v1: groups are small (typically 2–20 members), so the debt-simplification algorithm runs in O(n log n) in application code or a Postgres function over a handful of rows — a graph engine adds an entire extra system to operate for no measurable benefit at this scale. Revisit only if a future feature needs multi-hop debt discovery across arbitrary users at large scale (not currently planned).
- **No NoSQL** needed. If an activity/audit feed becomes very high-volume later, that log alone could move to a document store — a v2+ consideration, not foundational.

**Core schema (sketch)**

```
users              (id, email, display_name, avatar_url, default_currency)
groups             (id, name, icon, default_currency, created_by, created_at)
group_members      (group_id, user_id, role, joined_at)  PK(group_id, user_id)
invites            (token, group_id, created_by, expires_at, max_uses, uses)
categories         (id, group_id NULLABLE for global defaults, name, icon)
expenses           (id, group_id, description, category_id, total_amount_minor,
                     currency, paid_by, split_method, expense_date, created_by, created_at)
expense_payers     (expense_id, user_id, amount_minor)        -- supports multi-payer
expense_shares     (expense_id, user_id, share_amount_minor, share_percent, share_units)
settlements        (id, group_id, from_user, to_user, amount_minor, currency, settled_at)
```

All money columns stored as **integers in minor units** (paise/cents) — never floats.
`expense_shares.share_amount_minor` per expense must `SUM()` to `expenses.total_amount_minor` — enforced by the `create_expense` Edge Function inside a DB transaction, with a Postgres `CHECK`/trigger as a second line of defense.

---

## 5. Core Algorithms

1. **Split calculation**
   - *Equal*: `total / n`, remainder distributed via **largest-remainder method** (Hamilton's apportionment) so shares sum exactly to the total in minor units — never plain float division.
   - *Exact*: user-entered amounts, validated to sum to total.
   - *Percentage*: user-entered percentages (validated to sum to 100%), converted to minor units with the same largest-remainder rounding fix-up.
   - *Shares/weighted*: proportional to weights (e.g. 2:1:1), same rounding fix-up.

2. **Balance computation**: per group, per member net balance = `Σ(amount they paid across expenses) − Σ(their share across expenses) + Σ(settlements they made) − Σ(settlements made to them)`. Positive means the group owes them; negative means they owe the group.

   *(Corrected 2026-08-24: an earlier draft of this line had the settlement signs inverted. Paying someone moves your balance **up** toward zero — if you owe 50 and hand over 50, you go from −50 to 0 — so a settlement you made is added, not subtracted.)*

   Implemented as the `group_balances(group_id)` SQL function summing a `union all` ledger. Incremental maintenance on write is a later optimisation; at MVP group sizes the aggregate is cheap and has one obvious source of truth.

3. **Debt simplification ("settle up")**: classic Splitwise min-cash-flow heuristic — repeatedly take the member with the largest positive balance (creditor) and the member with the largest negative balance (debtor), settle `min(|creditor|, |debtor|)` between them, repeat until all balances are ~0. Greedy, O(n log n) with a max-heap; not guaranteed globally minimal transaction count (that variant is NP-hard, related to subset-sum/bin-partitioning) but matches what Splitwise itself does and is more than sufficient at typical group sizes.

4. **Invite tokens**: cryptographically random (nanoid/UUID), stored with optional `expires_at`/`max_uses`, validated server-side on join — never trust a client-supplied group id alone.

5. **Rounding/remainder distribution**: shared helper used by all split methods — always compute in integer minor units, use largest-remainder method to allocate the last few units so totals reconcile exactly (avoids the classic "splits sum to $19.99 instead of $20.00" bug).

6. **Personal/date-range aggregation**: parameterized SQL range queries (`expense_date BETWEEN`) with `GROUP BY category/date_bucket`; add materialized views only if/when query volume demands it — not needed for MVP scale.

7. **Categorization**: manual picklist selection for v1 (no ML). Noted as a future enhancement (auto-suggest category from description text) but explicitly out of scope now.

---

## 6. Tech Stack Summary

| Layer | Choice |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind, TanStack Query, `vite-plugin-pwa` |
| Backend | Supabase (Postgres, Auth, Realtime, Storage, Edge Functions) |
| Database | PostgreSQL (relational, ACID, RLS) |
| Hosting | Vercel/Netlify (frontend) + Supabase managed backend |

---

## 7. Suggested Phasing

- ~~**Phase 0** — Auth, groups CRUD, join-via-invite, DB schema + RLS policies~~ ✅ done
- ~~**Phase 1** — Expenses + live balances~~ ✅ done (merged into phase 2 — split methods have no meaning without expenses)
- ~~**Phase 2** — All split methods, categories (incl. custom), settle-up + debt simplification~~ ✅ done
- ~~**Phase 3** — Personal insights/date-range view, charts~~ ✅ done
- **Phase 4** — PWA polish (offline queue, install prompt), receipts, comments

### Implementation notes from phases 0–2

- **All writes that must be atomic go through `security definer` RPCs**, not PostgREST table writes:
  `create_group`, `create_expense`, `update_expense`, `settle_up`, `join_group_with_invite`.
- **`insert().select()` is a trap under RLS.** Postgres applies SELECT policies to `RETURNING`
  rows. Any table whose select policy depends on a row written by an `AFTER INSERT` trigger will
  return 403 on insert — this bit group creation, and is why the write path is RPC-based.
- The reconciliation invariant (payers sum = total, shares sum = total, both in minor units) is
  enforced inside `create_expense`. The browser only *previews* a split.
