import { ImageResponse } from "next/og";

export const alt = "LevelsGov — Federal Workforce Pay & Data";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0b1220 0%, #111c33 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", fontSize: 96 }}>🏛️</div>
        <div
          style={{
            display: "flex",
            marginTop: 24,
            fontSize: 72,
            fontWeight: 700,
            letterSpacing: -2,
          }}
        >
          LevelsGov
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 16,
            fontSize: 30,
            color: "#94a3b8",
          }}
        >
          Federal workforce pay & data, transparent and searchable
        </div>
        <div
          style={{
            display: "flex",
            marginTop: 40,
            fontSize: 24,
            color: "#64748b",
          }}
        >
          levelsgov.com
        </div>
      </div>
    ),
    size
  );
}
