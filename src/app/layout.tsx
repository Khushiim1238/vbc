import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "sonner";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Vardhman Building Center",
  description: "Vardhman Rewards & Order Management System",
  icons: {
    icon: [
      { url: '/v_logo.png?v=2' },
      { url: '/favicon.ico?v=2' },
    ],
    shortcut: '/v_logo.png?v=2',
    apple: '/v_logo.png?v=2',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VBC Rewards",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#FFFFFF",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans" suppressHydrationWarning>
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
