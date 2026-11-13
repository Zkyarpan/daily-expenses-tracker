"use client";

import { useState } from "react";
import { Check, CircleNotch, Eye, EyeSlash, Wallet } from "@phosphor-icons/react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Shared layout for every auth screen (sign in, sign up, forgot password,
 * set new password): brand panel on the left (desktop), form on the right.
 * Taken from the original login page so all four screens look the same.
 */

export const AUTH_INPUT_CLASS =
  "h-12 rounded-2xl border-2 px-4 text-sm focus-visible:border-primary";

export const AUTH_LABEL_CLASS = "text-sm font-semibold";

export const AUTH_LINK_CLASS =
  "font-semibold text-primary transition-colors hover:text-primary/80";

interface AuthShellProps {
  children: React.ReactNode;
  /** Bullet points in the brand panel. */
  features: string[];
  /** Supporting line under the brand-panel headline. */
  heroText: string;
  /** Large headline in the brand panel. */
  heroTitle: string;
}

export function AuthShell({ children, features, heroText, heroTitle }: AuthShellProps) {
  return (
    <div className="bg-background flex min-h-svh">
      {/* Left — brand panel */}
      <div className="bg-card border-border relative hidden w-[48%] flex-col justify-between overflow-hidden border-r p-12 lg:flex">
        {/* Subtle grid pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)`,
            backgroundSize: "32px 32px",
          }}
        />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <span className="bg-foreground flex size-10 items-center justify-center rounded-xl shadow-sm">
            <Wallet size={20} weight="duotone" className="text-background" />
          </span>
          <span className="text-base font-bold tracking-tight">Daily Expenses</span>
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl leading-tight font-bold" style={{ letterSpacing: "-0.035em" }}>
              {heroTitle}
            </h2>
            <p className="text-muted-foreground text-base leading-relaxed">{heroText}</p>
          </div>

          <ul className="space-y-3.5">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="bg-foreground/10 flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Check size={12} weight="bold" aria-hidden />
                </span>
                <span className="text-muted-foreground text-sm font-medium">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-muted-foreground/50 relative z-10 text-xs font-medium">
          © {new Date().getFullYear()} Daily Expenses Tracker
        </div>
      </div>

      {/* Right — form panel */}
      <div className="bg-background flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="mb-10 flex flex-col items-center gap-3 lg:hidden">
            <span className="bg-foreground flex size-14 items-center justify-center rounded-3xl shadow-lg">
              <Wallet size={28} weight="duotone" className="text-background" />
            </span>
            <span className="text-lg font-bold tracking-tight">Daily Expenses</span>
          </div>

          {children}
        </div>
      </div>
    </div>
  );
}

/** Page heading above the form. */
export function AuthHeading({ subtitle, title }: { subtitle: React.ReactNode; title: string }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.035em" }}>
        {title}
      </h1>
      <p className="text-muted-foreground mt-2 text-sm">{subtitle}</p>
    </div>
  );
}

/** Form-level error message. */
export function AuthError({ children }: { children: React.ReactNode }) {
  return (
    <div
      role="alert"
      className="border-destructive/20 bg-destructive/8 text-destructive rounded-2xl border px-4 py-3.5 text-sm font-medium"
    >
      {children}
    </div>
  );
}

/** Full-width primary submit button with a loading state. */
export function AuthSubmit({
  children,
  loading,
  loadingText,
}: {
  children: React.ReactNode;
  loading: boolean;
  loadingText: string;
}) {
  return (
    <Button type="submit" className="h-12 w-full rounded-2xl text-sm font-bold" disabled={loading} size="lg">
      {loading ? (
        <>
          <CircleNotch size={16} weight="bold" className="animate-spin" />
          {loadingText}
        </>
      ) : (
        children
      )}
    </Button>
  );
}

/** Password input with a show/hide toggle. */
export function PasswordInput({
  className,
  hideLabel = "Hide password",
  showLabel = "Show password",
  ...props
}: React.ComponentProps<typeof Input> & { hideLabel?: string; showLabel?: string }) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        {...props}
        type={visible ? "text" : "password"}
        className={cn(AUTH_INPUT_CLASS, "pr-12", className)}
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 -translate-y-1/2 transition-colors"
        aria-label={visible ? hideLabel : showLabel}
      >
        {visible ? <EyeSlash size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

/**
 * Live checklist for new passwords (length and match). Neutral colours: a
 * met rule turns from muted to foreground with a filled tick.
 */
export function PasswordChecklist({ confirm, password }: { confirm: string; password: string }) {
  const rules = [
    { met: password.length >= 8, text: "At least 8 characters" },
    { met: password.length > 0 && password === confirm, text: "Passwords match" },
  ];

  return (
    <ul className="space-y-1.5" aria-label="Password requirements">
      {rules.map((rule) => (
        <li
          key={rule.text}
          className={cn(
            "flex items-center gap-2 text-xs transition-colors",
            rule.met ? "text-foreground" : "text-muted-foreground",
          )}
        >
          <span
            aria-hidden
            className={cn(
              "flex size-4 items-center justify-center rounded-full transition-colors",
              rule.met ? "bg-foreground text-background" : "bg-muted",
            )}
          >
            {rule.met && <Check size={10} weight="bold" />}
          </span>
          {rule.text}
          <span className="sr-only">{rule.met ? "(met)" : "(not met)"}</span>
        </li>
      ))}
    </ul>
  );
}

/** Confirmation screen shown after an email has been sent. */
export function AuthNotice({
  children,
  icon,
  title,
}: {
  children: React.ReactNode;
  icon: React.ReactNode;
  title: string;
}) {
  return (
    <div role="status">
      <span className="bg-muted text-foreground ring-border mb-6 flex size-14 items-center justify-center rounded-2xl ring-1">
        {icon}
      </span>
      <h1 className="text-3xl font-bold" style={{ letterSpacing: "-0.035em" }}>
        {title}
      </h1>
      <div className="text-muted-foreground mt-3 space-y-2 text-sm leading-relaxed">{children}</div>
    </div>
  );
}
