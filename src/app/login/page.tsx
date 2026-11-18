"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AuthError,
  AuthHeading,
  AuthShell,
  AuthSubmit,
  PasswordInput,
} from "@/components/auth/AuthShell";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/authMessages";
import { createClient } from "@/utils/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const urlError = searchParams.get("error");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(urlError);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Enter your email address and password.");
      return;
    }
    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("Sign-in isn’t available", { description: "Authentication is not configured on this server." });
      setLoading(false);
      return;
    }

    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (authError) {
      const { description, title } = friendlyAuthError("sign-in", authError.message);
      toast.error(title, { description });
      setLoading(false);
      return;
    }

    const fullName = data.user?.user_metadata?.full_name;
    const firstName = typeof fullName === "string" ? fullName.trim().split(/\s+/)[0] : "";
    toast.success(firstName ? `Welcome back, ${firstName}` : "Welcome back", { description: "You’re signed in." });
    startRouteProgress();
    router.push(next);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {error && <AuthError>{error}</AuthError>}

      <div className="space-y-2">
        <Label htmlFor="email" className={AUTH_LABEL_CLASS}>
          Email address
        </Label>
        <Input
          id="email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
          className={AUTH_INPUT_CLASS}
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password" className={AUTH_LABEL_CLASS}>
            Password
          </Label>
          <Link href="/forgot-password" className={`text-xs ${AUTH_LINK_CLASS}`}>
            Forgot password?
          </Link>
        </div>
        <PasswordInput
          id="password"
          placeholder="••••••••"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      <AuthSubmit loading={loading} loadingText="Signing in…">
        Sign in
      </AuthSubmit>
    </form>
  );
}

export default function LoginPage() {
  return (
    <AuthShell
      heroTitle="The foundation for your finances."
      heroText="Track spending, set budgets, and get smart insights — all in one place."
      features={[
        "Real-time expense tracking",
        "Smart budget alerts",
        "AI spending insights",
        "Beautiful analytics",
      ]}
    >
      <AuthHeading title="Welcome back 👋" subtitle="Sign in to your account to continue." />

      {/* useSearchParams needs a Suspense boundary for static rendering. */}
      <Suspense fallback={<div className="h-[248px]" aria-hidden />}>
        <LoginForm />
      </Suspense>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className={AUTH_LINK_CLASS}>
          Create one →
        </Link>
      </p>
    </AuthShell>
  );
}
