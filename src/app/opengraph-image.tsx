import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Matches the site's own dark-green/purple system (see icon.tsx's brand mark and the card
// design already used on real promotional graphics) - this is what shows up as the link
// preview when the site's URL is shared on Reddit, Discord, X, iMessage, etc.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "linear-gradient(180deg, #0e2015 0%, #16301f 42%, #0a1610 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 40 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "linear-gradient(145deg, #7A3FFF, #5417C9)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 34,
              fontWeight: 900,
            }}
          >
            M
          </div>
          <span style={{ color: "#f3efe3", fontSize: 36, fontWeight: 900, letterSpacing: -1 }}>
            Matchday OS
          </span>
        </div>
        <div style={{ display: "flex", color: "#f3efe3", fontSize: 56, fontWeight: 900, letterSpacing: -2, lineHeight: 1.1, maxWidth: 960 }}>
          Plans your transfers and captaincy across the full gameweek horizon
        </div>
        <div style={{ display: "flex", color: "#8fa394", fontSize: 26, fontWeight: 600, marginTop: 28 }}>
          Free · No account needed · matchdayfpl.co.uk
        </div>
      </div>
    ),
    { ...size },
  );
}
