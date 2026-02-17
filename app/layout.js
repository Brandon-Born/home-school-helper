import "./globals.css";
import { ThemeProvider } from "./components/theme/ThemeProvider.js";
import { THEME_BOOTSTRAP_SCRIPT } from "../src/lib/theme-mode.js";

export const metadata = {
  title: "Homeschool Tutor",
  description: "Voice-friendly homeschool tutor with private parent steering"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
