import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Homeschool Sidekick guides social preview";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guides"
      title="Homeschool AI tutoring guides"
      subtitle="Practical guides for voice-first tutoring, math help, and parent-guided learning routines."
    />,
    size
  );
}
