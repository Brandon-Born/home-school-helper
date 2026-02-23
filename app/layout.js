import "./globals.css";
import { ThemeProvider } from "./components/theme/ThemeProvider.js";
import { buildRootMetadata } from "../src/lib/seo.js";

export const metadata = buildRootMetadata();

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Outfit:wght@600;700;800&display=swap"
          rel="stylesheet"
        />
        <script src="/theme-bootstrap.js" />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
