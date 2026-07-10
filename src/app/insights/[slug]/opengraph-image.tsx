import { ImageResponse } from "next/og";
import { getPublishedPost } from "@/lib/pb";

export const alt = "LevelsGov Research article";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function OpengraphImage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = await getPublishedPost(slug);
  const title = post?.title ?? "Federal Workforce Research";
  const dateLabel = post ? formatDate(post.published_at) : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b1220 0%, #111c33 100%)",
          color: "#ffffff",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontSize: 28,
            color: "#94a3b8",
          }}
        >
          <span>🏛️</span>
          <span style={{ fontWeight: 600, color: "#e2e8f0" }}>LevelsGov</span>
          <span>·</span>
          <span>Research</span>
        </div>
        <div
          style={{
            display: "flex",
            fontSize: title.length > 90 ? 44 : 56,
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: -1,
            maxWidth: 1050,
          }}
        >
          {title.length > 140 ? `${title.slice(0, 140)}…` : title}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 24,
            color: "#64748b",
          }}
        >
          <span>{dateLabel}</span>
          <span>levelsgov.com/insights</span>
        </div>
      </div>
    ),
    size
  );
}
