import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clenzit Franchise Intelligence",
  description: "Location intelligence for Clenzit franchise expansion.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
