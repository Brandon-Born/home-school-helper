import { ImageResponse } from "next/og";
import { SeoPreviewCard } from "../src/lib/seo-image.js";

export const alt = "Homeschool Sidekick: parent-guided AI tutoring for homeschool families";
export const size = {
  width: 1200,
  height: 630
};
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <SeoPreviewCard
      width={size.width}
      height={size.height}
    />,
    size
  );
}
