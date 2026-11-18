/**
 * tests/profileServer.test.ts
 *
 * Same-origin guard used by every state-changing /api/profile route
 * (src/lib/profile/server.ts → rejectCrossSite).
 *
 * Run: node_modules/.bin/tsx --test tests/profileServer.test.ts
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { rejectCrossSite } from "../src/lib/profile/server.js";

const request = (url: string, headers: Record<string, string>) => new Request(url, { headers, method: "PATCH" });

describe("rejectCrossSite", () => {
  it("allows same-origin requests", () => {
    const r = request("http://localhost:3001/api/profile", { host: "localhost:3001", origin: "http://localhost:3001" });
    assert.equal(rejectCrossSite(r), null);
  });

  it("allows requests without an Origin header (same-origin GET/HEAD, server calls)", () => {
    assert.equal(rejectCrossSite(request("http://localhost:3001/api/profile", { host: "localhost:3001" })), null);
  });

  it("uses the Host header when Next rebuilt request.url with another hostname", () => {
    const r = request("http://localhost:3001/api/profile", { host: "192.168.1.20:3001", origin: "http://192.168.1.20:3001" });
    assert.equal(rejectCrossSite(r), null);
  });

  it("rejects other sites with 403", () => {
    const r = request("http://localhost:3001/api/profile", { host: "localhost:3001", origin: "https://evil.example" });
    assert.equal(rejectCrossSite(r)?.status, 403);
  });

  it("rejects a malformed Origin", () => {
    const r = request("http://localhost:3001/api/profile", { host: "localhost:3001", origin: "null" });
    assert.equal(rejectCrossSite(r)?.status, 403);
  });
});
