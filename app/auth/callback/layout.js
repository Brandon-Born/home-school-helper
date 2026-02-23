import { buildNoIndexMetadata } from "../../../src/lib/seo.js";

export const metadata = buildNoIndexMetadata({
  title: "Sign-in Callback | Homeschool Sidekick",
  description: "Authentication callback page for securely completing parent sign-in."
});

export default function AuthCallbackRouteLayout({ children }) {
  return children;
}
