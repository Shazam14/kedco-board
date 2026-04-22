import type { Metadata } from "next";
import "./globals.css";
import DateOverrideBanner from './_components/DateOverrideBanner';

export const metadata: Metadata = {
  title: "Kedco FX — Capital Dashboard",
  description: "Live capital position & operations dashboard for Kedco Foreign Exchange Services",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <DateOverrideBanner />
      </body>
    </html>
  );
}
