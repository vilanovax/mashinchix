import type { Metadata } from "next";
import { Geist_Mono, Vazirmatn } from "next/font/google";
import { Providers } from "@/components/providers/providers";
import "./globals.css";

const vazirmatn = Vazirmatn({
  variable: "--font-vazirmatn",
  subsets: ["arabic", "latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Mashinchi — مشاور سرمایه‌گذاری خودرو",
  description: "داشبورد، اقدام امروز، سبد و هوش بازار",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl">
      <body
        className={`${vazirmatn.variable} ${geistMono.variable} min-h-screen antialiased font-sans`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
