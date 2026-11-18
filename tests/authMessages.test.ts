/**
 * tests/authMessages.test.ts — friendly pop-up text for sign-in / sign-up /
 * password errors (src/lib/authMessages.ts).
 *
 * Run: node_modules/.bin/tsx --test tests/authMessages.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { friendlyAuthError } from "../src/lib/authMessages.js";

describe("friendlyAuthError", () => {
  it("explains common Supabase errors in plain words", () => {
    assert.deepEqual(friendlyAuthError("sign-in", "Invalid login credentials"), {
      description: "That email and password don’t match. Check them and try again.",
      title: "Couldn’t sign you in",
    });
    assert.match(friendlyAuthError("sign-in", "Email not confirmed").description, /confirm your email/);
    assert.match(friendlyAuthError("sign-up", "User already registered").description, /already an account/);
    assert.match(friendlyAuthError("reset", "email rate limit exceeded").description, /Too many attempts/);
    assert.match(
      friendlyAuthError("update-password", "New password should be different from the old password.").description,
      /must be different/,
    );
    assert.match(
      friendlyAuthError("sign-up", "Password should be at least 8 characters.").description,
      /stronger password/,
    );
  });

  it("titles the pop-up by what the user was doing", () => {
    assert.equal(friendlyAuthError("sign-up", "x").title, "Couldn’t create your account");
    assert.equal(friendlyAuthError("reset", "x").title, "Couldn’t send the reset link");
    assert.equal(friendlyAuthError("update-password", "x").title, "Couldn’t update your password");
  });

  it("keeps unknown messages, and never shows an empty description", () => {
    assert.equal(friendlyAuthError("sign-in", "Something odd happened").description, "Something odd happened");
    assert.equal(friendlyAuthError("sign-in", "").description, "Something went wrong. Please try again.");
    assert.equal(friendlyAuthError("sign-in", null).description, "Something went wrong. Please try again.");
  });
});
