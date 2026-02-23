import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../../src/lib/seo-image.js";

export const alt = "Voice tutor for kids guide social preview";
export const size = { width: 1200, height: 600 };
export const contentType = "image/png";

export default function TwitterImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
      eyebrow="Parent Guide"
      title="Voice tutor for kids"
      subtitle="Voice-first sessions for children, with parent control, transcripts, and hints-first teaching."
    />,
    size
  );
}
