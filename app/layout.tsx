import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "កម្មវិធីផ្ទុក — កម្មវិធីទាញយកមេឌៀ",
  description: "ទាញយក MP3 និង MP4 ដោយគ្មានការផ្សាយពាណិជ្ជកម្ម",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
