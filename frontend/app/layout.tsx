import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "คำร้องขอ ปพ.1/ปพ.7",
    template: "%s | ระบบบันทึกคำร้อง ปพ.1/ปพ.7",
  },
  description:
    "บริการจัดการคำร้อง ปพ.1 และ ปพ.7 — ดาวน์โหลดไฟล์ ปพ.1/ปพ.7 เป็น PDF พร้อมการตรวจสอบสถานะคำร้อง",
  keywords: [
    "ปพ.1",
    "ปพ.7",
    "คำร้อง",
    "Transcript",
    "คำขอเอกสารการศึกษา",
    "โรงเรียน",
  ],
  authors: [
    { name: "ระบบคำร้อง ปพ.1/ปพ.7", url: "https://pp1.krufame.work" },
  ],
  creator: "records-and-assessment",
  publisher: "records-and-assessment",
  applicationName: "ระบบคำร้อง ปพ.1/ปพ.7",
  openGraph: {
    title: "คำร้องขอ ปพ.1/ปพ.7",
    description:
      "จัดการคำร้อง ปพ.1 และ ปพ.7 ออนไลน์ — สร้าง ดาวน์โหลด และติดตามสถานะคำร้อง",
  url: "https://pp1.krufame.work",
    siteName: "ระบบคำร้อง ปพ.1/ปพ.7",
    images: [
      {
        url: "/logo-ppk-512x512-1.ico",
        width: 512,
        height: 512,
        alt: "โลโก้",
      },
    ],
    locale: "th_TH",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "คำร้องขอ ปพ.1/ปพ.7",
    description:
      "จัดการคำร้อง ปพ.1 และ ปพ.7 ออนไลน์ — สร้าง ดาวน์โหลด และติดตามสถานะคำร้อง",
    site: "@your_twitter",
    creator: "@your_twitter",
  },
  icons: {
    icon: "/logo-ppk-512x512-1.ico",
    shortcut: "/logo-ppk-512x512-1.ico",
    apple: "/logo-ppk-512x512-1.ico",
  },
  themeColor: [{ media: "(prefers-color-scheme: light)", color: "#ffffff" }, { media: "(prefers-color-scheme: dark)", color: "#000000" }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
  alternates: {
  canonical: "https://pp1.krufame.work",
    languages: {
      "th-TH": "/",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
  <html lang="th">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
