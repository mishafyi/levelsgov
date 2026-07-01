"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Something went wrong</h1>
          <p style={{ marginTop: "0.5rem", color: "#666" }}>
            A critical error occurred. Please try again.
          </p>
          <button
            onClick={reset}
            style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", background: "#111", color: "#fff", border: "none", cursor: "pointer" }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
