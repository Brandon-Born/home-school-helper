import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Math help for homeschool guide social preview";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="Math help for homeschool"
      subtitle="Parent-guided AI math practice with step-by-step hints and private coaching nudges."
    />,
    size
  );
}
