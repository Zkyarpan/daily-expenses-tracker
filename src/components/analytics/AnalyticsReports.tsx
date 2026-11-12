"use client";

import { memo } from "react";
import { Download } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const STATUS_LABEL: Record<BudgetStatus, string> = {
  critical: "At limit",
  over: "Over budget",
  under: "On track",
  warning: "Near limit",
};

const STATUS_CLASS: Record<BudgetStatus, string> = {
  critical: "border-orange-500/40 text-orange-600 dark:text-orange-400",
  over: "border-destructive/40 text-destructive",
  under: "border-green-600/40 text-green-700 dark:text-green-400",
  warning: "border-amber-500/40 text-amber-600 dark:text-amber-400",
};

const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

const signedMoney = (value: number | null) =>
  value === null ? "—" : `${value > 0 ? "+" : ""}${formatCurrency(value)}`;

const ExportButton = ({
  disabled,
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Button variant="outline" size="sm" className="gap-1.5" onClick={onClick} disabled={disabled}>
    <Download className="size-3.5" aria-hidden />
    {label}
  </Button>
);

const EmptyRow = ({ colSpan, children }: { colSpan: number; children: React.ReactNode }) => (
  <TableRow>
    <TableCell colSpan={colSpan} className="text-muted-foreground h-24 text-center">
      {children}
    </TableCell>
  </TableRow>
);

type AnalyticsReportsProps = {
  data: AnalyticsResult;
  budgetsStatus: BudgetsForYearsStatus;
};

const AnalyticsReports = ({ budgetsStatus, data }: AnalyticsReportsProps) => {
  const period = formatRangeLabel(data.range);
  const fileSuffix = `${toDateKey(data.range.start)}_${toDateKey(data.range.end)}`;
  const { budgets, categories, monthly, overview } = data;
  const monthlyCount = monthly.reduce((n, m) => n + m.count, 0);

  return (
    <Card className="min-w-0 shadow-none">
      <CardHeader>
        <CardTitle>Financial reports</CardTitle>
        <CardDescription>{period}</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="monthly" className="gap-4">
          {/* justify-start so overflow scrolls right on narrow screens instead of clipping the first tab */}
          <TabsList className="max-w-full justify-start overflow-x-auto">

            <TabsTrigger value="monthly">Monthly summary</TabsTrigger>
            <TabsTrigger value="categories">Category breakdown</TabsTrigger>
            <TabsTrigger value="budgets">Budget performance</TabsTrigger>
          </TabsList>

          {/* ── Monthly expense summary ─────────────────────────────────── */}
          <TabsContent value="monthly" className="space-y-3">
            <div className="flex justify-end">
              <ExportButton
                label="Export CSV"
                onClick={() => downloadCsv(`monthly-expense-summary_${fileSuffix}`, monthlySummaryCsv(monthly))}
              />
            </div>
            <Table>
              <TableCaption className="sr-only">Monthly expense summary for {period}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Avg. transaction</TableHead>
                  <TableHead className="text-right">vs previous month</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthly.map((m) => (
                  <TableRow key={m.key}>
                    <TableCell className="font-medium">{m.label}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(m.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{m.count}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {m.count > 0 ? formatCurrency(m.total / m.count) : "—"}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums",
                        m.change !== null && m.change > 0 && "text-destructive",
                        m.change !== null && m.change < 0 && "text-green-700 dark:text-green-400",
                      )}
                    >
                      {signedMoney(m.change)}
                      {m.changePct !== null && (
                        <span className="text-muted-foreground ml-1 text-xs">({pct(m.changePct)})</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(overview.totalSpending)}</TableCell>
                  <TableCell className="text-right tabular-nums">{monthlyCount}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {monthlyCount > 0 ? formatCurrency(overview.averageTransaction) : "—"}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TabsContent>

          {/* ── Category spending breakdown ─────────────────────────────── */}
          <TabsContent value="categories" className="space-y-3">
            <div className="flex justify-end">
              <ExportButton
                label="Export CSV"
                disabled={categories.length === 0}
                onClick={() => downloadCsv(`category-spending-breakdown_${fileSuffix}`, categoryBreakdownCsv(categories))}
              />
            </div>
            <Table>
              <TableCaption className="sr-only">Category spending breakdown for {period}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Transactions</TableHead>
                  <TableHead className="text-right">Avg. transaction</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories.length === 0 ? (
                  <EmptyRow colSpan={5}>No spending in this period.</EmptyRow>
                ) : (
                  categories.map((c) => (
                    <TableRow key={c.key}>
                      <TableCell className="font-medium">
                        <span className="flex items-center gap-2">
                          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: getCategoryColor(c.name) }} aria-hidden />
                          {c.name}
                        </span>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{pct(c.share)}</TableCell>
                      <TableCell className="text-right tabular-nums">{c.count}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(c.average)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {categories.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(sumAmounts(categories.map((c) => c.total)))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">100%</TableCell>
                    <TableCell className="text-right tabular-nums">{overview.transactionCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(overview.averageTransaction)}</TableCell>
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TabsContent>

          {/* ── Budget performance summary ──────────────────────────────── */}
          <TabsContent value="budgets" className="space-y-3">
            <div className="flex justify-end">
              <ExportButton
                label="Export CSV"
                disabled={!budgets || budgets.rows.length === 0}
                onClick={() =>
                  downloadCsv(`budget-performance-summary_${fileSuffix}`, budgetPerformanceCsv(budgets?.rows ?? []))
                }
              />
            </div>
            <Table>
              <TableCaption className="sr-only">Budget performance summary for {period}</TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Spent</TableHead>
                  <TableHead className="text-right">Remaining</TableHead>
                  <TableHead className="text-right">Utilisation</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {budgetsStatus === "loading" ? (
                  <EmptyRow colSpan={6}>Loading budgets…</EmptyRow>
                ) : budgetsStatus === "unavailable" ? (
                  <EmptyRow colSpan={6}>Budgets are not set up yet, so there is nothing to report.</EmptyRow>
                ) : budgetsStatus === "error" ? (
                  <EmptyRow colSpan={6}>Budgets could not be loaded.</EmptyRow>
                ) : !budgets || budgets.rows.length === 0 ? (
                  <EmptyRow colSpan={6}>No budgets in this period.</EmptyRow>
                ) : (
                  budgets.rows.map((r) => (
                    <TableRow key={r.key}>
                      <TableCell className="font-medium">
                        {r.name}
                        {r.months > 1 && (
                          <span className="text-muted-foreground ml-1 text-xs">({r.months} months)</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.limit)}</TableCell>
                      <TableCell className="text-right tabular-nums">{formatCurrency(r.spent)}</TableCell>
                      <TableCell className={cn("text-right tabular-nums", r.remaining < 0 && "text-destructive")}>
                        {formatCurrency(r.remaining)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{pct(r.utilisation)}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className={STATUS_CLASS[r.status]}>
                          {STATUS_LABEL[r.status]}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {budgets && budgets.rows.length > 0 && (
                <TableFooter>
                  <TableRow>
                    <TableCell>Total</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(budgets.totalLimit)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(budgets.totalSpent)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(budgets.totalLimit - budgets.totalSpent)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{pct(budgets.utilisation)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              )}
            </Table>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default memo(AnalyticsReports);
