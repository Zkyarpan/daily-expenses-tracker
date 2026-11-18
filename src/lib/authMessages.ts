/**
 * src/lib/authMessages.ts
 *
 * Friendly titles and descriptions for the pop-ups on the sign-in, sign-up
 * and password pages, instead of raw Supabase Auth messages. Unknown errors
 * keep the original message as the description.
 */

export type AuthAction = "reset" | "sign-in" | "sign-up" | "update-password";

const TITLES: Record<AuthAction, string> = {
  reset: "Couldn’t send the reset link",
  "sign-in": "Couldn’t sign you in",
  "sign-up": "Couldn’t create your account",
  "update-password": "Couldn’t update your password",
};

const RULES: [pattern: RegExp, description: string][] = [
  [/invalid login credentials|invalid_credentials/i, "That email and password don’t match. Check them and try again."],
  [/email not confirmed/i, "Please confirm your email first — check your inbox for the link we sent."],
  [/user already registered|already been registered|already exists/i, "There’s already an account with this email. Try signing in instead."],
  [/rate limit|too many requests|security purposes/i, "Too many attempts. Please wait a minute and try again."],
  // Checked before the weak-password rule: Supabase words it "should be different…".
  [/same.*(old|current) password|different from the old password/i, "Your new password must be different from your current one."],
  [/password should (be at least|contain)|weak password|password is too weak/i, "Choose a stronger password — at least 8 characters, mixing letters and numbers."],
  [/invalid email|unable to validate email|email address .* is invalid/i, "That email address doesn’t look right."],
  [/session (missing|not found)|auth session missing|jwt expired/i, "Your reset link has expired. Request a new one."],
  [/network|fetch failed|failed to fetch/i, "We couldn’t reach the server. Check your connection and try again."],
];

export function friendlyAuthError(action: AuthAction, message: string | null | undefined): { description: string; title: string } {
  const text = message ?? "";
  const match = RULES.find(([pattern]) => pattern.test(text));
  return {
    description: match?.[1] ?? (text || "Something went wrong. Please try again."),
    title: TITLES[action],
  };
}
