"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDownLeft, ArrowUpRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useMoneyMutations } from "@/hooks/money/useMoneyMutations";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { localToday } from "@/lib/api/money";
import { type Iou, IOU_DIRECTIONS, type IouDirection } from "@/lib/money/schemas";
import { cn } from "@/lib/utils";

import { amountText, MoneyInput, toAmountText } from "./fields";

const schema = z
  .object({
    amount: amountText,
    date: z.string().min(1, "Choose a date."),
    description: z.string().trim().max(200, "Keep the note under 200 characters."),
    direction: z.enum(IOU_DIRECTIONS),
    dueDate: z.string(),
    person: z.string().trim().min(1, "Enter a name.").max(60, "Keep the name under 60 characters."),
  })
  .refine((v) => !v.dueDate || v.dueDate >= v.date, {
    message: "The due date can’t be before the date.",
    path: ["dueDate"],
  });

type Values = z.infer<typeof schema>;

const DIRECTIONS: { description: string; icon: typeof ArrowUpRight; label: string; value: IouDirection }[] = [
  { description: "They owe you", icon: ArrowUpRight, label: "I lent money", value: "lent" },
  { description: "You owe them", icon: ArrowDownLeft, label: "I borrowed money", value: "borrowed" },
];

function IouForm({
  direction,
  iou,
  onDone,
  people,
}: {
  direction: IouDirection;
  iou?: Iou;
  onDone: () => void;
  people: string[];
}) {
  const { createIou, updateIou } = useMoneyMutations();
  const form = useForm<Values>({
    defaultValues: {
      amount: toAmountText(iou?.amount),
      date: iou?.date ?? localToday(),
      description: iou?.description ?? "",
      direction: iou?.direction ?? direction,
      dueDate: iou?.dueDate ?? "",
      person: iou?.person ?? "",
    },
    resolver: zodResolver(schema),
  });
  const chosen = useWatch({ control: form.control, name: "direction" });
  const { isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const fields = {
      amount: Number(values.amount),
      date: values.date,
      description: values.description || null,
      direction: values.direction,
      dueDate: values.dueDate || null,
      person: values.person,
    };
    try {
      if (iou) await updateIou.mutateAsync({ id: iou.id, update: { action: "edit", ...fields } });
      else await createIou.mutateAsync(fields);
      toast.success(iou ? "Entry updated" : values.direction === "lent" ? `Saved — ${values.person} owes you` : `Saved — you owe ${values.person}`);
      onDone();
    } catch (error) {
      const field = error instanceof ApiError ? (error.field as keyof Values | undefined) : undefined;
      form.setError(field && field in values ? field : "root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        <div role="radiogroup" aria-label="Who owes who" className="grid grid-cols-2 gap-2">
          {DIRECTIONS.map(({ description, icon: Icon, label, value }) => {
            const selected = chosen === value;
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => form.setValue("direction", value, { shouldDirty: true })}
                className={cn(
                  "focus-visible:ring-ring flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  selected ? "border-primary ring-primary bg-muted/40 ring-1" : "hover:bg-muted/40",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-lg",
                    value === "lent" ? "bg-success/10 text-success" : "bg-warning/10 text-warning",
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="text-muted-foreground block text-xs">{description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="person"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{chosen === "lent" ? "Lent to" : "Borrowed from"}</FormLabel>
                <FormControl>
                  <Input placeholder="Name" list="iou-people" autoComplete="off" autoFocus={!iou} {...field} />
                </FormControl>
                <datalist id="iou-people">
                  {people.map((p) => (
                    <option key={p} value={p} />
                  ))}
                </datalist>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="amount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Amount</FormLabel>
                <FormControl>
                  <MoneyInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Date</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dueDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Pay back by (optional)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What for? (optional)</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Concert tickets, dinner, rent share" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {form.formState.errors.root && (
          <p role="alert" className="text-destructive text-sm">
            {form.formState.errors.root.message}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" size="sm" onClick={onDone} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={isSubmitting} className="gap-1.5">
            {isSubmitting && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {iou ? "Save changes" : "Add entry"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function IouFormDialog({
  direction = "lent",
  iou,
  onOpenChange,
  open,
  people = [],
}: {
  direction?: IouDirection;
  iou?: Iou;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  people?: string[];
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{iou ? "Edit entry" : "Lend or borrow"}</DialogTitle>
          <DialogDescription>Keep track of who owes who, and mark it settled when it’s paid back.</DialogDescription>
        </DialogHeader>
        {open && (
          <IouForm
            key={iou?.id ?? direction}
            direction={direction}
            iou={iou}
            people={people}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
