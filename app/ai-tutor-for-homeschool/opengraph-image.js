import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "AI tutor for homeschool families guide preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="How to use an AI tutor for homeschool learning."
      subtitle="Parent-guided setup, hints-first teaching, voice-first options, and privacy-aware routines."
    />,
    size
  );
}
