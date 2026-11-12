# Architecture Overview

High-level map of how the app is structured. Useful context before touching unfamiliar areas.

---

## Pages

| Route | File | Description |
|-------|------|-------------|
| `/` | `app/(protected)/page.tsx` | Public financial dashboard with yearly overview and recent activity |
| `/expenses` | `app/expenses/page.tsx` | Monthly expense table with inline editing, bulk ops, and summary header |
| `/yearly-charts` | `app/yearly-charts/page.tsx` | Annual analytics with 9 tabbed charts and export (PDF/Excel) |
| `/import-expenses` | `app/import-expenses/page.tsx` | 3-step CSV/PDF import wizard |
| `/trackers` | `app/trackers/page.tsx` | Misc tracker cards (debts, savings, loans) |

---

## Data Flow

```
Supabase (PostgreSQL)
  └── src/utils/supabase/          # Browser client and configuration
        └── src/lib/supabase.ts    # Shared browser client + data-mode helpers
        └── src/hooks/             # React Query hooks (queries + mutations)
              └── Page components  # Consume hooks, manage local state
                    └── Feature components  # Receive data as props
```

**Demo data**: the existing hooks still return hardcoded sample data when the
Supabase data client is unavailable. Application routes are public; live data
requires the configured Supabase policies to allow the browser client to read
and write the relevant tables.

---

## Key Files

| File | Role |
|------|------|
| `src/lib/config.ts` | All hardcoded config: categories, tags, members, colors, locale |
| `src/lib/utils.ts` | `cn()`, `formatCurrency()`, `formatCurrencyCompact()`, `stripExpenseDetails()` |
| `src/lib/dateUtils.ts` | `parseLocalDate()`, `getYearOptions()` — always use these for date handling |
| `src/entities/` | TypeScript types: `Expense`, `ExpenseWithDetails`, `Tracker`, `TrackerEntry` |

---

## Component Ownership

### Expenses feature
- `ExpenseHeader` — monthly total, category cards, member pie, trend delta badge
- `CategoryCard` — single category total with animated amount and progress bar
- `MemberCard` — pie chart of spending by member
- `BulkUpdate` — toolbar shown when rows are selected
- `DataTable` (in `app/expenses/`) — TanStack Table with inline editing, skeleton loading, empty state
- `columns.tsx` — TanStack column definitions with editable cell renderers

### Yearly Charts feature
- `YearlyChartsGrid` — manages tab grouping and drag-to-reorder (All tab only)
- `*Chart.tsx` files — individual Recharts chart components, each receives `expenses: ExpenseWithDetails[]`
- `MonthFilter`, `CategoryFilter` — multi-select dropdowns for filtering

### Trackers feature
- `TrackerCard` — full card with balance, entries table, MagicCard effect, circular progress
- `CreateTrackerSheet` — create/edit form (React Hook Form + Zod)
- `AddEntrySheet` — add debit/credit entry

### Import feature
- `CSVImportWizard` — orchestrates 3-step wizard with step indicator breadcrumb
- `CSVImportContext` — shared wizard state (step, mappedData, documentStyle)
- `*Mapping` components — format-specific column mapping UIs

### Layout
- `AppSideBar` — collapsible sidebar with icon-only mode
- `Navbar` — sticky top bar; hosts `CommandPalette` and theme toggle
- `CommandPalette` — ⌘K global navigation dialog

---

## State Management

| State type | Mechanism |
|------------|-----------|
| Server data | TanStack React Query — cached, deduplicated, background refetch |
| Local edits | `useState` in page components — optimistic, flushed on save |
| UI state | `useState` in component — e.g. `showCharts`, `showAll`, `rowSelection` |
| Chart order | `localStorage` via `useState` lazy init in `YearlyChartsGrid` |
| Theme | `next-themes` |
| Sidebar open | shadcn `SidebarProvider` + cookie persistence |
| Import wizard | React Context (`CSVImportContext`) |

---

## Database Indexes

| Index | Column | Reason |
|-------|--------|--------|
| `idx_expenses_date` | `expenses(date DESC)` | Covers range scans (`gte`/`lt`) and `ORDER BY date DESC` used by both `useExpenses` and `useYearlyExpenses` — eliminates full table scans and avoids a separate sort step |

To apply:
```sql
CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses (date DESC);
```

If multi-tenant filtering by user is added later, replace with a composite index: `(user_id, date DESC)`.

---

## Date Handling

**Critical**: Supabase returns date columns as `"YYYY-MM-DD"` strings. `new Date("YYYY-MM-DD")` parses as UTC and shifts one day back in US timezones.

Always use `parseLocalDate(str)` from `@/lib/dateUtils` when converting date strings to Date objects. Query Supabase DATE columns with plain strings, never `.toISOString()`.

See `src/memory/dates.md` for full details.

---

## Export

- **PDF**: `window.print()` triggered via `handleExportPdf()` in `yearly-charts/page.tsx`. Forces light mode, sets document title, then restores state.
- **Excel**: `exportToExcel()` from `src/lib/exportExcel.ts` using the `xlsx` library.
- Charts use `print:hidden` to suppress UI chrome from PDF output.
