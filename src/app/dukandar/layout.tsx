import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Dukandar Portal | Vardhman Building Solution",
  description: "Vardhman Dukandar Orders & Rewards Management System",
  manifest: "/manifest-dukandar.json",
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/v_logo.png?v=2' },
      { url: '/favicon.ico?v=2' },
    ],
    shortcut: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "VBC Dukandar",
  },
};

export default function DukandarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
