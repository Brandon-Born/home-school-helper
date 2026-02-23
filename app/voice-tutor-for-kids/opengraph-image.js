import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Voice tutor for kids guide preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="Voice tutor for kids, guided by parents."
      subtitle="Voice-first tutoring for younger learners, with private parent nudges and hints before answers."
    />,
    size
  );
}
