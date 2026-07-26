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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${serif.variable} antialiased`} suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
