import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { UserProvider } from "@/lib/user-context";
import { CurrencyProvider } from "@/lib/currency-context";
import { BudgetProvider } from "@/lib/budget-context";
import { GoalProvider } from "@/lib/goal-context";
import { AppShell } from "@/components/app-shell";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PagosWA - Dashboard",
  description: "Control de gastos inteligente via Telegram",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PagosWA",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#09090b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <head>
        <link rel="apple-touch-icon" href="/icon-192.png" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-zinc-950 text-white`}
      >
        <UserProvider>
          <BudgetProvider>
            <CurrencyProvider>
              <GoalProvider>
                <AppShell>
                  {children}
                </AppShell>
              </GoalProvider>
            </CurrencyProvider>
          </BudgetProvider>
        </UserProvider>
      </body>
    </html>
  );
}
