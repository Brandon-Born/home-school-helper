import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Homeschool Sidekick parent guides preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Homeschool Sidekick Guides"
      title="Parent guides for AI tutoring at home."
      subtitle="Voice-first tutoring, math practice, and parent-guided workflows for homeschool families."
    />,
    size
  );
}
