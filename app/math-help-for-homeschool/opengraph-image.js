import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Math help for homeschool guide preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="Math help for homeschool, with hints before answers."
      subtitle="Use parent-guided AI tutoring for math practice, repeated explanations, and voice-first support."
    />,
    size
  );
}
