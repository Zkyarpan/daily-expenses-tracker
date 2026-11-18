"use client";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useMoneyMutations } from "@/hooks/money/useMoneyMutations";
import { ApiError, apiErrorMessage } from "@/lib/api/client";
import { DEFAULT_CATEGORIES } from "@/lib/config";
import { PRIORITIES, type Priority, type WishlistItem } from "@/lib/money/schemas";
import { cn } from "@/lib/utils";

import { amountText, MoneyInput, optionalAmountText, toAmountText } from "./fields";

const schema = z
  .object({
    categoryId: z.string().min(1),
    name: z.string().trim().min(1, "Enter what you want to buy.").max(80, "Keep the name under 80 characters."),
    notes: z.string().trim().max(300, "Keep notes under 300 characters."),
    price: amountText,
    priority: z.enum(PRIORITIES),
    savedAmount: optionalAmountText,
    targetDate: z.string(),
    url: z
      .string()
      .trim()
      .max(500, "That link is too long.")
      .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Links must start with http:// or https://"),
  })
  .refine((v) => !v.savedAmount || Number(v.savedAmount) <= Number(v.price), {
    message: "Saved can’t be more than the price.",
    path: ["savedAmount"],
  });

type Values = z.infer<typeof schema>;

export const PRIORITY_LABEL: Record<Priority, string> = { high: "Must have", low: "Someday", medium: "Want" };

function WishlistForm({ item, onDone }: { item?: WishlistItem; onDone: () => void }) {
  const { createWishlistItem, updateWishlistItem } = useMoneyMutations();
  const form = useForm<Values>({
    defaultValues: {
      categoryId: item?.categoryId ?? "4",
      name: item?.name ?? "",
      notes: item?.notes ?? "",
      price: toAmountText(item?.price),
      priority: item?.priority ?? "medium",
      savedAmount: toAmountText(item?.savedAmount),
      targetDate: item?.targetDate ?? "",
      url: item?.url ?? "",
    },
    resolver: zodResolver(schema),
  });
  const priority = useWatch({ control: form.control, name: "priority" });
  const { isSubmitting } = form.formState;

  async function onSubmit(values: Values) {
    const fields = {
      categoryId: values.categoryId,
      name: values.name,
      notes: values.notes || null,
      price: Number(values.price),
      priority: values.priority,
      targetDate: values.targetDate || null,
      url: values.url || null,
    };
    try {
      if (item) {
        await updateWishlistItem.mutateAsync({ id: item.id, update: { action: "edit", ...fields } });
        // Saved money is changed with "Add savings"; only adjust it here if edited.
        const saved = Number(values.savedAmount || 0);
        if (Math.round(saved * 100) !== Math.round(item.savedAmount * 100)) {
          await updateWishlistItem.mutateAsync({
            id: item.id,
            update: { action: "save", amount: Math.round((saved - item.savedAmount) * 100) / 100 },
          });
        }
      } else {
        await createWishlistItem.mutateAsync({ ...fields, savedAmount: Number(values.savedAmount || 0) });
      }
      toast.success(item ? "Item updated" : `“${values.name}” added to your wishlist`);
      onDone();
    } catch (error) {
      const field = error instanceof ApiError ? (error.field as keyof Values | undefined) : undefined;
      form.setError(field && field in values ? field : "root", { message: apiErrorMessage(error) });
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>What do you want to buy?</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Noise-cancelling headphones" autoFocus={!item} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="price"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Price</FormLabel>
                <FormControl>
                  <MoneyInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="savedAmount"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Saved so far (optional)</FormLabel>
                <FormControl>
                  <MoneyInput {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium" id="priority-label">
            How much do you want it?
          </p>
          <div role="radiogroup" aria-labelledby="priority-label" className="grid grid-cols-3 gap-2">
            {PRIORITIES.map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={priority === value}
                onClick={() => form.setValue("priority", value, { shouldDirty: true })}
                className={cn(
                  "focus-visible:ring-ring rounded-xl border px-3 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                  priority === value ? "border-primary ring-primary bg-muted/40 ring-1" : "text-muted-foreground hover:bg-muted/40",
                )}
              >
                {PRIORITY_LABEL[value]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="categoryId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Category when bought</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {DEFAULT_CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="targetDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Buy by (optional)</FormLabel>
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
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Link (optional)</FormLabel>
              <FormControl>
                <Input type="url" placeholder="https://" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes (optional)</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Colour, size, where to buy…" className="resize-none" {...field} />
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
            {item ? "Save changes" : "Add to wishlist"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

export function WishlistFormDialog({
  item,
  onOpenChange,
  open,
}: {
  item?: WishlistItem;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100svh-2rem)] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit wishlist item" : "Add to wishlist"}</DialogTitle>
          <DialogDescription>Save up for it, then mark it bought — it can go straight into your expenses.</DialogDescription>
        </DialogHeader>
        {open && <WishlistForm key={item?.id ?? "new"} item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
