/**
 * src/lib/api/profile.ts
 *
 * Browser client for the profile backend (src/app/api/profile/**). Errors
 * are `ApiError`s (see ./client.ts).
 */

import type {
  AccountInfo,
  ActivityResponse,
  DeleteAccountInput,
  PasswordChange,
  ProfileRecord,
  ProfileStats,
  ProfileStorage,
  ProfileUpdate,
  SampleDataCounts,
} from "@/lib/profile/schemas";

import { ApiError, json, request } from "./client";

export { ApiError, apiErrorMessage } from "./client";

export const profileApi = {
  activity: () => request<ActivityResponse>("/api/profile/activity"),
  changeEmail: (email: string) => request<{ sentTo: string }>("/api/profile/email", json("POST", { email })),
  changePassword: (input: PasswordChange) => request<{ ok: true }>("/api/profile/password", json("POST", input)),
  deleteAccount: (input: DeleteAccountInput) => request<{ deleted: true }>("/api/profile", json("DELETE", input)),
  get: () => request<{ account: AccountInfo; profile: ProfileRecord; storage: ProfileStorage }>("/api/profile"),
  loadSampleData: () =>
    request<{ counts: SampleDataCounts; warnings: string[] }>("/api/profile/sample-data", json("POST")),
  removeSampleData: () => request<{ removed: SampleDataCounts }>("/api/profile/sample-data", json("DELETE")),
  sampleDataStatus: () => request<{ counts: SampleDataCounts }>("/api/profile/sample-data"),
  signOutEverywhere: () => request<{ ok: true }>("/api/profile/sessions", json("DELETE")),
  stats: () => request<ProfileStats>("/api/profile/stats"),
  update: (patch: ProfileUpdate) =>
    request<{ profile: ProfileRecord; storage: ProfileStorage }>("/api/profile", json("PATCH", patch)),
};

/** Downloads the CSV export; resolves to the number of expenses in it. */
export async function downloadExpensesExport(): Promise<number> {
  const response = await fetch("/api/profile/export", { cache: "no-store", credentials: "same-origin" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiError(body.error ?? "Export failed. Please try again.", response.status, body);
  }
  const filename =
    /filename="([^"]+)"/.exec(response.headers.get("content-disposition") ?? "")?.[1] ?? "daily-expenses-export.csv";
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  return Number(response.headers.get("x-export-count") ?? 0);
}
