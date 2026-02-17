export const metadata = {
  title: "Homeschool Tutor",
  description: "Agentic tutor with parent steering"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>{children}</body>
    </html>
  );
}
