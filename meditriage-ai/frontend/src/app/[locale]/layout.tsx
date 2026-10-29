import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { ChatLauncher } from "@/components/chat/ChatLauncher";
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-latin',
  display: 'swap',
});

const notoSansDevanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
});

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--font-display',
  display: 'swap',
});

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
    <html lang={locale} className={`${plusJakartaSans.variable} ${notoSansDevanagari.variable} ${spaceGrotesk.variable}`}>
      <body className="antialiased min-h-screen flex flex-col bg-bg text-ink font-sans selection:bg-primary-soft selection:text-primary">
        <NextIntlClientProvider messages={messages} locale={locale}>
          <AuthProvider>
            <Header />
            <main className="flex-1">
              {children}
            </main>
            <Footer />
            <ChatLauncher />
          </AuthProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
