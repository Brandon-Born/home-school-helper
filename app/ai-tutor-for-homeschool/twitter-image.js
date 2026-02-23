import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "AI tutor for homeschool guide social preview";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="AI tutor for homeschool families"
      subtitle="Parent-guided setup. Hints-first support. Voice-first tutoring options."
    />,
    size
  );
}
