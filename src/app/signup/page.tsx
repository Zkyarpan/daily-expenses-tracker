"use client";

import { useState } from "react";
import { EnvelopeSimple } from "@phosphor-icons/react";
import Link from "next/link";

import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AuthError,
  AuthHeading,
  AuthNotice,
  AuthShell,
  AuthSubmit,
  PasswordChecklist,
  PasswordInput,
} from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";

const SIGNUP_HERO = {
  features: [
    "Free to use, no credit card required",
    "Import from CSV or bank statements",
    "Monthly budgets and smart alerts",
  ],
  heroText: "Create your free account and begin tracking your expenses in minutes.",
  heroTitle: "Start your financial journey.",
};

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  function validate(): string | null {
    if (!name.trim()) return "Full name is required.";
    if (!email.trim()) return "Email is required.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password !== confirmPassword) return "Passwords do not match.";
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      setError("Authentication is not configured.");
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.signUp({
      email,
      options: {
        data: { full_name: name.trim() },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <AuthShell {...SIGNUP_HERO}>
        <AuthNotice title="Check your email" icon={<EnvelopeSimple size={26} />}>
          <p>
            We&apos;ve sent a confirmation link to{" "}
            <span className="text-foreground font-medium">{email}</span>. Click the link to
            activate your account.
          </p>
          <p>Can&apos;t find it? Check your spam folder.</p>
        </AuthNotice>
        <Button asChild variant="outline" className="mt-8 h-12 w-full rounded-2xl text-sm font-bold">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...SIGNUP_HERO}>
      <AuthHeading title="Create an account" subtitle="Enter your details to get started for free." />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <AuthError>{error}</AuthError>}

        <div className="space-y-2">
          <Label htmlFor="name" className={AUTH_LABEL_CLASS}>
            Full name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="Jane Smith"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={loading}
            className={AUTH_INPUT_CLASS}
          />
        </div>

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
          <Label htmlFor="password" className={AUTH_LABEL_CLASS}>
            Password
          </Label>
          <PasswordInput
            id="password"
            placeholder="Min. 8 characters"
            autoComplete="new-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="confirm-password" className={AUTH_LABEL_CLASS}>
            Confirm password
          </Label>
          <PasswordInput
            id="confirm-password"
            placeholder="••••••••"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={loading}
            hideLabel="Hide confirm password"
            showLabel="Show confirm password"
          />
        </div>

        <PasswordChecklist password={password} confirm={confirmPassword} />

        <AuthSubmit loading={loading} loadingText="Creating account…">
          Create account
        </AuthSubmit>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className={AUTH_LINK_CLASS}>
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}
