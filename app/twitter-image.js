import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../src/lib/seo-image.js";

export const alt = "Homeschool Sidekick social preview image";
export const size = {
  width: 1200,
  height: 600
};
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      title="Parent-guided AI tutoring for homeschool families."
      subtitle="Voice-first tutoring. Private parent nudges. Hints before answers."
    />,
    size
  );
}
