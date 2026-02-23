import { buildNoIndexMetadata } from "../../src/lib/seo.js";

export const metadata = buildNoIndexMetadata({
  title: "Join Session | Homeschool Sidekick",
  description: "Join a Homeschool Sidekick tutoring session with a parent-provided code."
});

export default function ChildRouteLayout({ children }) {
  return children;
}
