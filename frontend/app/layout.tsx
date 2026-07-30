import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CURIO Education ERP",
  description: "School operations ERP for African education teams.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>
        {children}
        <footer className="global-footer">CURIO Version 1.0 2026 Copyrighted.</footer>
      </body>
    </html>
  );
}