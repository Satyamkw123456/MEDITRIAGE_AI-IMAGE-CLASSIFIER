import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

export const metadata: Metadata = {
  title: "MediTriage AI | Geriatric Clinical Decision-Support System",
  description: "AI-assisted clinical decision support for geriatric triage. Personalized baselines, medication masking alerts, and clinician-in-the-loop decision support.",
};

export default async function RootLayout({
  children,
  params: {locale}
}: {
  children: React.ReactNode;
  params: {locale: string};
}) {
  const messages = await getMessages({locale});

  return (
    <html lang={locale}>
      <body className="antialiased min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>

          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
