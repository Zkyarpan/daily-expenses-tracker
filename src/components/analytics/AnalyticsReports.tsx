"use client";

import { memo, type ReactNode, useState } from "react";
import { Download } from "lucide-react";

import { Meter, type MeterTone } from "@/components/shared/Meter";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { BudgetsForYearsStatus } from "@/hooks/budgets/useBudgetsForYears";
import {
  type AnalyticsResult,
  budgetPerformanceCsv,
  type BudgetStatus,
  categoryBreakdownCsv,
  formatRangeLabel,
  monthlySummaryCsv,
  sumAmounts,
  toDateKey,
} from "@/lib/analytics";
import { downloadCsv } from "@/lib/downloadCsv";
import { cn, formatCurrency, getCategoryColor } from "@/lib/utils";

import { AnalyticsPanel } from "./chartShared";

const STATUS: Record<BudgetStatus, { label: string; tone: StatusTone; meter: MeterTone }> = {
  critical: { label: "At limit", meter: "warning", tone: "warning" },
  over: { label: "Over budget", meter: "critical", tone: "critical" },
  under: { label: "On track", meter: "success", tone: "success" },
  warning: { label: "Near limit", meter: "warning", tone: "warning" },
};

type ReportTab = "budgets" | "categories" | "monthly";

const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

const signedMoney = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${formatCurrency(value)}`;

const NUM = "text-right tabular-nums";

/** Framed table: muted header row, consistent cell padding. */
const ReportTable = ({ caption, children }: { caption: string; children: ReactNode }) => (
  <div className="overflow-hidden rounded-xl border">
    <Table className="[&_td]:px-3 [&_td]:py-2.5 [&_th]:px-3">
      <TableCaption className="sr-only">{caption}</TableCaption>
      {children}
    </Table>
  </div>
);

const ReportHeader = ({ children }: { children: ReactNode }) => (
  <TableHeader className="bg-muted/40 [&_th]:text-muted-foreground [&_th]:text-xs [&_th]:font-medium">
    <TableRow className="hover:bg-transparent">{children}</TableRow>
  </TableHeader>
);

const EmptyRow = ({ colSpan, children }: { colSpan: number; children: ReactNode }) => (
  <TableRow className="hover:bg-transparent">
    <TableCell colSpan={colSpan} className="text-muted-foreground h-28 text-center">
      {children}
    </TableCell>
  </TableRow>
);

type AnalyticsReportsProps = {
  data: AnalyticsResult;
  budgetsStatus: BudgetsForYearsStatus;
};

const AnalyticsReports = ({ budgetsStatus, data }: AnalyticsReportsProps) => {
  const [tab, setTab] = useState<ReportTab>("monthly");
  const period = formatRangeLabel(data.range);
  const fileSuffix = `${toDateKey(data.range.start)}_${toDateKey(data.range.end)}`;
  const { budgets, categories, monthly, overview } = data;
  const monthlyCount = monthly.reduce((n, m) => n + m.count, 0);
  const hasBudgetRows = !!budgets && budgets.rows.length > 0;

  const exports: Record<ReportTab, { disabled: boolean; run: () => void }> = {
    budgets: {
      disabled: !hasBudgetRows,
      run: () => downloadCsv(`budget-performance-summary_${fileSuffix}`, budgetPerformanceCsv(budgets?.rows ?? [])),
    },
    categories: {
      disabled: categories.length === 0,
      run: () => downloadCsv(`category-spending-breakdown_${fileSuffix}`, categoryBreakdownCsv(categories)),
    },
    monthly: {
      disabled: false,
      run: () => downloadCsv(`monthly-expense-summary_${fileSuffix}`, monthlySummaryCsv(monthly)),
    },
  };

  return (
    <AnalyticsPanel title="Financial reports" description={period}>
      <Tabs value={tab} onValueChange={(v) => setTab(v as ReportTab)} className="gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* justify-start so overflow scrolls right on narrow screens instead of clipping the first tab */}
          <TabsList className="max-w-full justify-start overflow-x-auto">
            <TabsTrigger value="monthly" className="px-3">Monthly summary</TabsTrigger>
            <TabsTrigger value="categories" className="px-3">Category breakdown</TabsTrigger>
            <TabsTrigger value="budgets" className="px-3">Budget performance</TabsTrigger>
          </TabsList>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={exports[tab].run}
            disabled={exports[tab].disabled}
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </Button>
        </div>

        {/* ── Monthly expense summary ─────────────────────────────────── */}
        <TabsContent value="monthly">
          <ReportTable caption={`Monthly expense summary for ${period}`}>
            <ReportHeader>
              <TableHead>Month</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Avg. transaction</TableHead>
              <TableHead className="text-right">vs previous month</TableHead>
            </ReportHeader>
            <TableBody>
              {monthly.map((m) => (
                <TableRow key={m.key}>
                  <TableCell className="font-medium">{m.label}</TableCell>
                  <TableCell className={cn(NUM, "font-medium")}>{formatCurrency(m.total)}</TableCell>
                  <TableCell className={NUM}>{m.count}</TableCell>
                  <TableCell className={NUM}>{m.count > 0 ? formatCurrency(m.total / m.count) : "—"}</TableCell>
                  <TableCell
                    className={cn(
                      NUM,
                      m.change !== null && m.change > 0 && "text-destructive",
                      m.change !== null && m.change < 0 && "text-success",
                    )}
                  >
                    {signedMoney(m.change)}
                    {m.changePct !== null && (
                      <span className="text-muted-foreground ml-1.5 text-xs">{pct(m.changePct)}</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell>Total</TableCell>
                <TableCell className={NUM}>{formatCurrency(overview.totalSpending)}</TableCell>
                <TableCell className={NUM}>{monthlyCount}</TableCell>
                <TableCell className={NUM}>
                  {monthlyCount > 0 ? formatCurrency(overview.averageTransaction) : "—"}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          </ReportTable>
        </TabsContent>

        {/* ── Category spending breakdown ─────────────────────────────── */}
        <TabsContent value="categories">
          <ReportTable caption={`Category spending breakdown for ${period}`}>
            <ReportHeader>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Share</TableHead>
              <TableHead className="text-right">Transactions</TableHead>
              <TableHead className="text-right">Avg. transaction</TableHead>
            </ReportHeader>
            <TableBody>
              {categories.length === 0 ? (
                <EmptyRow colSpan={5}>No spending in this period.</EmptyRow>
              ) : (
                categories.map((c) => {
                  const color = getCategoryColor(c.name);
                  return (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden />
                          {c.name}
                        </span>
                      </TableCell>
                      <TableCell className={cn(NUM, "font-medium")}>{formatCurrency(c.total)}</TableCell>
                      <TableCell className={NUM}>
                        <span className="inline-flex items-center justify-end gap-2.5">
                          <span className="bg-muted hidden h-1.5 w-16 overflow-hidden rounded-full sm:block" aria-hidden>
                            <span
                              className="block h-full rounded-full"
                              style={{ backgroundColor: color, width: `${Math.min(100, Math.max(0, c.share ?? 0))}%` }}
                            />
                          </span>
                          <span className="w-12">{pct(c.share)}</span>
                        </span>
                      </TableCell>
                      <TableCell className={NUM}>{c.count}</TableCell>
                      <TableCell className={NUM}>{formatCurrency(c.average)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {categories.length > 0 && (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell>Total</TableCell>
                  <TableCell className={NUM}>{formatCurrency(sumAmounts(categories.map((c) => c.total)))}</TableCell>
                  <TableCell className={NUM}>100%</TableCell>
                  <TableCell className={NUM}>{overview.transactionCount}</TableCell>
                  <TableCell className={NUM}>{formatCurrency(overview.averageTransaction)}</TableCell>
                </TableRow>
              </TableFooter>
            )}
          </ReportTable>
        </TabsContent>

        {/* ── Budget performance summary ──────────────────────────────── */}
        <TabsContent value="budgets">
          <ReportTable caption={`Budget performance summary for ${period}`}>
            <ReportHeader>
              <TableHead>Category</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">Utilisation</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </ReportHeader>
            <TableBody>
              {budgetsStatus === "loading" ? (
                <EmptyRow colSpan={6}>Loading budgets…</EmptyRow>
              ) : budgetsStatus === "unavailable" ? (
                <EmptyRow colSpan={6}>Budgets are not set up yet, so there is nothing to report.</EmptyRow>
              ) : budgetsStatus === "error" ? (
                <EmptyRow colSpan={6}>Budgets could not be loaded.</EmptyRow>
              ) : !hasBudgetRows ? (
                <EmptyRow colSpan={6}>No budgets in this period.</EmptyRow>
              ) : (
                budgets.rows.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell className="font-medium">
                      {r.name}
                      {r.months > 1 && (
                        <span className="text-muted-foreground ml-1.5 text-xs font-normal">{r.months} months</span>
                      )}
                    </TableCell>
                    <TableCell className={NUM}>{formatCurrency(r.limit)}</TableCell>
                    <TableCell className={cn(NUM, "font-medium")}>{formatCurrency(r.spent)}</TableCell>
                    <TableCell className={cn(NUM, r.remaining < 0 && "text-destructive")}>
                      {formatCurrency(r.remaining)}
                    </TableCell>
                    <TableCell className={NUM}>
                      <span className="inline-flex items-center justify-end gap-2.5">
                        <Meter
                          size="sm"
                          className="hidden w-16 sm:block"
                          label={`${r.name} budget used`}
                          value={r.utilisation ?? 0}
                          tone={STATUS[r.status].meter}
                          valueText={pct(r.utilisation)}
                        />
                        <span className="w-14">{pct(r.utilisation)}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge tone={STATUS[r.status].tone} dot>
                        {STATUS[r.status].label}
                      </StatusBadge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {hasBudgetRows && (
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell>Total</TableCell>
                  <TableCell className={NUM}>{formatCurrency(budgets.totalLimit)}</TableCell>
                  <TableCell className={NUM}>{formatCurrency(budgets.totalSpent)}</TableCell>
                  <TableCell className={NUM}>{formatCurrency(budgets.totalLimit - budgets.totalSpent)}</TableCell>
                  <TableCell className={NUM}>{pct(budgets.utilisation)}</TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            )}
          </ReportTable>
        </TabsContent>
      </Tabs>
    </AnalyticsPanel>
  );
};

export default memo(AnalyticsReports);
