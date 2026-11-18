/**
 * src/lib/assistant/server.ts
 *
 * Runs a parsed question against the signed-in user's data (with their own
 * session, so RLS applies) and builds the reply. Only the data a question
 * needs is read.
 */

import type { SupabaseClient, User } from "@supabase/supabase-js";

import { fetchIous, fetchWishlist, isSetupError } from "@/lib/money/server";
import { monthSavings } from "@/lib/money/summary";
import { loadPlan } from "@/lib/plan/server";
import { readProfile } from "@/lib/profile/server";
import { fetchExpenseRowsBetween } from "@/lib/supabase/queries";

import {
  answerHelp,
  answerOwed,
  answerPlan,
  answerSavings,
  answerSpending,
  answerWishlist,
  type AssistantAnswer,
  type SpendRow,
} from "./answer";
import { type AssistantQuery, resolvePeriod } from "./query";

const SETUP_ANSWER = (feature: string): AssistantAnswer => ({
  context: {},
  facts: [],
  followUps: ["How much did I spend this month?"],
  items: [],
  link: { href: "/lend-borrow", label: "Finish setup" },
  text: `${feature} needs the one-time database setup first. Open Lend & borrow and follow “Finish setup”.`,
});

async function spendRows(supabase: SupabaseClient, userId: string, from: string, to: string): Promise<SpendRow[]> {
  const rows = await fetchExpenseRowsBetween(supabase, userId, from, to, "amount,date,description,categoryId,tagId");
  return rows.map((r) => ({
    amount: Number(r.amount),
    categoryId: r.categoryId ?? null,
    date: String(r.date),
    description: r.description ?? null,
    tagId: r.tagId ?? null,
  }));
}

async function thisMonthSavings(supabase: SupabaseClient, user: User, today: string) {
  const { profile } = await readProfile(supabase, user);
  const rows = await spendRows(supabase, user.id, `${today.slice(0, 7)}-01`, today);
  const spent = rows.reduce((s, r) => s + Math.round(r.amount * 100), 0) / 100;
  return monthSavings({ goal: profile.monthlySavingsGoal, income: profile.monthlyIncome, spent, today });
}

export async function runAssistantQuery({
  query,
  supabase,
  today,
  user,
}: {
  query: AssistantQuery;
  supabase: SupabaseClient;
  today: string;
  user: User;
}): Promise<AssistantAnswer> {
  switch (query.intent) {
    case "spending": {
      const period = resolvePeriod(query.period, today);
      const [current, previous] = await Promise.all([
        spendRows(supabase, user.id, period.from, period.to),
        period.previous ? spendRows(supabase, user.id, period.previous.from, period.previous.to) : Promise.resolve(null),
      ]);
      const reply = answerSpending({ current, period, previous, query });
      return { ...reply, context: { ...reply.context, period: query.period } };
    }
    case "owed": {
      try {
        return answerOwed({ ious: await fetchIous(supabase, user.id), query, today });
      } catch (error) {
        if (isSetupError(error)) return SETUP_ANSWER("Lend & borrow");
        throw error;
      }
    }
    case "savings":
      return answerSavings(await thisMonthSavings(supabase, user, today));
    case "plan": {
      const [plan, savings] = await Promise.all([loadPlan(supabase, user, today), thisMonthSavings(supabase, user, today)]);
      return answerPlan("setupRequired" in plan ? null : plan.summary, savings);
    }
    case "wishlist": {
      try {
        const [items, savings] = await Promise.all([fetchWishlist(supabase, user.id), thisMonthSavings(supabase, user, today)]);
        return answerWishlist({ items, query, safeToSpend: savings.safeToSpend });
      } catch (error) {
        if (isSetupError(error)) return SETUP_ANSWER("The wishlist");
        throw error;
      }
    }
    case "help":
    default:
      return answerHelp();
  }
}
