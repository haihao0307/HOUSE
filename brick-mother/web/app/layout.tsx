import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Brick Mother 砖块母体窝",
  description: "土坯、烧结砖与石块的轻量程序化三维母体实验室。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
