"use client";

import { useState } from "react";
import { Check, CircleNotch, Eye, EyeSlash } from "@phosphor-icons/react";

import { LogoMark } from "@/components/brand/Logo";
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
    <div className="bg-background app-backdrop flex min-h-svh">
      {/* Left — brand panel: solid indigo with a soft glow and dot grid */}
      <div className="relative hidden w-[46%] flex-col justify-between overflow-hidden bg-[linear-gradient(150deg,#6d5df8_0%,#4b3be0_45%,#2a1d9e_100%)] p-12 text-white lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.14]"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.9) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
          }}
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -top-40 -right-32 size-[30rem] rounded-full bg-[#c8f542]/20 blur-3xl"
        />

        {/* Logo only */}
        <div className="relative z-10">
          <LogoMark className="size-14 drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]" title="Daily Expenses" />
        </div>

        {/* Hero text */}
        <div className="relative z-10 space-y-8">
          <div className="space-y-4">
            <h2 className="text-4xl leading-tight font-bold text-white" style={{ letterSpacing: "-0.035em" }}>
              {heroTitle}
            </h2>
            <p className="text-base leading-relaxed text-white/75">{heroText}</p>
          </div>

          <ul className="space-y-3.5">
            {features.map((feature) => (
              <li key={feature} className="flex items-center gap-3">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#c8f542] text-[#24301a]">
                  <Check size={12} weight="bold" aria-hidden />
                </span>
                <span className="text-sm font-medium text-white/85">{feature}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs font-medium text-white/55">© {new Date().getFullYear()}</p>
      </div>

      {/* Right — form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          {/* Mobile: logo only */}
          <div className="mb-10 flex justify-center lg:hidden">
            <LogoMark className="size-16 drop-shadow-lg" title="Daily Expenses" />
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
