import "./globals.css";
import { ThemeProvider } from "./components/theme/ThemeProvider.js";
import { THEME_BOOTSTRAP_SCRIPT } from "../src/lib/theme-mode.js";

export const metadata = {
  title: "Home School Helper",
  description: "A tutoring assistant where parents guide and kids learn — step by step."
};

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
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
