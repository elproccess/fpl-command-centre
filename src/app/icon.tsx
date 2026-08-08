import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

// Same mark used in the site's own nav brand (see Brand() in page.tsx): purple gradient
// square with a white "M" - this replaces Next.js's default favicon.
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 14,
          background: "linear-gradient(145deg, #7A3FFF, #5417C9)",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 38,
            fontWeight: 900,
            fontFamily: "sans-serif",
          }}
        >
          M
        </span>
      </div>
    ),
    { ...size },
  );
}
