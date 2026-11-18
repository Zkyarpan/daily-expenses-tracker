import { ImageResponse } from "next/og";

import { LOGO_DATA_URL } from "@/components/brand/brandArt";

export const size = { height: 180, width: 180 };
export const contentType = "image/png";

/** Home-screen icon for iPhone/iPad (Apple ignores SVG favicons). */
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ background: "#00746d", display: "flex", height: "100%", width: "100%" }}>
        <img src={LOGO_DATA_URL} width={180} height={180} alt="" />
      </div>
    ),
    size,
  );
}
