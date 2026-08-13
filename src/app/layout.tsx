import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { DbBootstrap } from "@/components/DbBootstrap";
import { PwaRegister } from "@/components/PwaRegister";
import "./globals.css";

const noto = Noto_Sans_JP({
  variable: "--font-noto",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "らくスコア",
  description: "記号いらずの野球スコア記録",
  icons: {
    icon: [
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "らくスコア",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#070a08",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className={`${noto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-[#070a08] text-[#f4f7f0]">
        <PwaRegister />
        <DbBootstrap />
        {children}
      </body>
    </html>
  );
}
