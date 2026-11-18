"use client";

import { useState } from "react";
import { ArrowLeft, EnvelopeSimple } from "@phosphor-icons/react";
import Link from "next/link";
import { toast } from "sonner";

import {
  AUTH_INPUT_CLASS,
  AUTH_LABEL_CLASS,
  AUTH_LINK_CLASS,
  AuthError,
  AuthHeading,
  AuthNotice,
  AuthShell,
  AuthSubmit,
} from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/authMessages";
import { createClient } from "@/utils/supabase/client";

const RESET_HERO = {
  features: [
    "We email you a secure reset link",
    "Your expenses and budgets stay untouched",
    "Choose a new password and you're back in",
  ],
  heroText: "Enter the email you signed up with and we'll help you get back into your account.",
  heroTitle: "Forgot your password? It happens.",
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("This isn’t available", { description: "Authentication is not configured on this server." });
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/update-password`,
    });

    if (authError) {
      const { description, title } = friendlyAuthError("reset", authError.message);
      toast.error(title, { description });
      setLoading(false);
      return;
    }

    toast.success("Reset link sent", { description: `Check ${email} for a link to choose a new password.` });
    setSuccess(true);
    setLoading(false);
  }

  if (success) {
    return (
      <AuthShell {...RESET_HERO}>
        <AuthNotice title="Check your inbox" icon={<EnvelopeSimple size={26} />}>
          <p>
            We&apos;ve sent a password reset link to{" "}
            <span className="text-foreground font-medium">{email}</span>.
          </p>
          <p>
            Didn&apos;t receive it? Check your spam folder or{" "}
            <button
              type="button"
              className={AUTH_LINK_CLASS}
              onClick={() => {
                setSuccess(false);
                setEmail("");
              }}
            >
              try again
            </button>
            .
          </p>
        </AuthNotice>
        <Button asChild variant="outline" className="mt-8 h-12 w-full rounded-2xl text-sm font-bold">
          <Link href="/login">
            <ArrowLeft size={16} weight="bold" />
            Back to sign in
          </Link>
        </Button>
      </AuthShell>
    );
  }

  return (
    <AuthShell {...RESET_HERO}>
      <AuthHeading
        title="Reset your password"
        subtitle="Enter your account email and we'll send you a reset link."
      />

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

        <AuthSubmit loading={loading} loadingText="Sending link…">
          Send reset link
        </AuthSubmit>
      </form>

      <p className="text-muted-foreground mt-6 text-center text-sm">
        Remembered your password?{" "}
        <Link href="/login" className={AUTH_LINK_CLASS}>
          Sign in →
        </Link>
      </p>
    </AuthShell>
  );
}
