import type { Metadata } from "next";
import { Newsreader } from "next/font/google";
import "./globals.css";

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Nurosand",
  description:
    "Rehab coaching: doctor plans, adaptive daily exercises, spoken coaching, weekly sign-off.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${serif.variable} antialiased`}>{children}</body>
    </html>
  );
}
