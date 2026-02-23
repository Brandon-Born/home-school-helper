import React from "react";

function buildGradientBackground() {
  return "linear-gradient(135deg, #f4f0ff 0%, #ece8ff 45%, #dff8f3 100%)";
}

export function SeoPreviewCard({
  width,
  height,
  eyebrow = "Homeschool Sidekick",
  title = "AI tutoring for homeschool families, guided by parents.",
  subtitle = "Voice-first learning. Hints before answers. Private parent guidance. COPPA-focused controls."
}) {
  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        background: buildGradientBackground(),
        color: "#1a1530",
        fontFamily: "Inter, system-ui, sans-serif",
        position: "relative"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 24,
          borderRadius: 28,
          background: "rgba(255,255,255,0.78)",
          border: "1px solid rgba(109, 74, 237, 0.12)",
          boxShadow: "0 20px 60px rgba(56, 37, 120, 0.12)"
        }}
      />

      <div
        style={{
          position: "absolute",
          top: 48,
          right: 64,
          width: 240,
          height: 240,
          borderRadius: 999,
          background: "radial-gradient(circle at 35% 35%, rgba(45,212,191,0.55), rgba(45,212,191,0.08) 60%, transparent 72%)"
        }}
      />

      <div
        style={{
          position: "absolute",
          left: 56,
          bottom: 52,
          width: 210,
          height: 210,
          borderRadius: 30,
          background: "linear-gradient(160deg, rgba(109,74,237,0.18), rgba(109,74,237,0.04))",
          border: "1px solid rgba(109,74,237,0.08)",
          transform: "rotate(-8deg)"
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "58px 64px",
          width: "100%"
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "#0f766e",
              fontSize: 28,
              fontWeight: 700,
              alignSelf: "flex-start"
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 999,
                background: "#0d9488",
                boxShadow: "0 0 0 8px rgba(13,148,136,0.12)"
              }}
            />
            {eyebrow}
          </div>

          <div
            style={{
              fontSize: width >= 1100 ? 68 : 58,
              lineHeight: 1.05,
              fontWeight: 800,
              letterSpacing: -1.4,
              maxWidth: width >= 1100 ? 900 : 760
            }}
          >
            {title}
          </div>

          <div
            style={{
              fontSize: width >= 1100 ? 28 : 24,
              lineHeight: 1.3,
              color: "#5f5876",
              maxWidth: width >= 1100 ? 840 : 760
            }}
          >
            {subtitle}
          </div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          <Badge label="Voice-first" />
          <Badge label="Hints, not answers" />
          <Badge label="Parent controls" />
        </div>
      </div>
    </div>
  );
}

function Badge({ label }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        padding: "12px 18px",
        borderRadius: 999,
        border: "1px solid rgba(13,148,136,0.18)",
        background: "rgba(255,255,255,0.72)",
        color: "#244055",
        fontSize: 22,
        fontWeight: 700
      }}
    >
      {label}
    </div>
  );
}
