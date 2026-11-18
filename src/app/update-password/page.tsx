"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  AUTH_LABEL_CLASS,
  AuthError,
  AuthHeading,
  AuthShell,
  AuthSubmit,
  PasswordChecklist,
  PasswordInput,
} from "@/components/auth/AuthShell";
import { startRouteProgress } from "@/components/layout/RouteProgress";
import { Label } from "@/components/ui/label";
import { friendlyAuthError } from "@/lib/authMessages";
import { createClient } from "@/utils/supabase/client";

export default function UpdatePasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    if (!supabase) {
      toast.error("This isn’t available", { description: "Authentication is not configured on this server." });
      setLoading(false);
      return;
    }

    const { error: authError } = await supabase.auth.updateUser({ password });

    if (authError) {
      const { description, title } = friendlyAuthError("update-password", authError.message);
      toast.error(title, { description });
      setLoading(false);
      return;
    }

    toast.success("Password updated", { description: "You’re signed in with your new password." });
    startRouteProgress();
    router.push("/");
    router.refresh();
  }

  return (
    <AuthShell
      heroTitle="Almost there."
      heroText="Choose a new password and you'll go straight back to your dashboard."
      features={[
        "Use at least 8 characters",
        "Mix letters, numbers and symbols",
        "Avoid a password you use elsewhere",
      ]}
    >
      <AuthHeading title="Set a new password" subtitle="Choose a strong password for your account." />

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {error && <AuthError>{error}</AuthError>}

        <div className="space-y-2">
          <Label htmlFor="password" className={AUTH_LABEL_CLASS}>
            New password
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
            Confirm new password
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

        <AuthSubmit loading={loading} loadingText="Updating password…">
          Update password
        </AuthSubmit>
      </form>
    </AuthShell>
  );
}
