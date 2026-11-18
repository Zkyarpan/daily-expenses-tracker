import { ImageResponse } from "next/og";

import { LOGO_DATA_URL } from "@/components/brand/brandArt";
import { SITE } from "@/lib/site";

export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { height: 630, width: 1200 };
export const contentType = "image/png";

/** Share card for links posted to social apps and messengers. */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(150deg, #6d5df8 0%, #4b3be0 45%, #1f1580 100%)",
          color: "white",
          display: "flex",
          flexDirection: "column",
          height: "100%",
          justifyContent: "space-between",
          padding: 80,
          width: "100%",
        }}
      >
        <img src={LOGO_DATA_URL} width={120} height={120} alt="" />
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05 }}>
            Know where every pound goes.
          </div>
          <div style={{ color: "rgba(255,255,255,0.78)", fontSize: 32 }}>
            Spending, savings goals, who owes who — and an AI that answers from your own numbers.
          </div>
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          {["Budgets & alerts", "Lend & borrow", "Savings plan", "Receipt scanning"].map((label) => (
            <div
              key={label}
              style={{
                background: "rgba(255,255,255,0.14)",
                border: "1px solid rgba(255,255,255,0.25)",
                borderRadius: 999,
                fontSize: 24,
                padding: "10px 22px",
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    size,
  );
}
