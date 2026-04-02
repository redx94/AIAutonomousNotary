import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/providers';
import Navbar from '@/components/navbar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: {
    default: 'AI Autonomous Notary',
    template: '%s | AI Autonomous Notary',
  },
  description:
    'Blockchain-powered document notarization with AI validation, NFT seals, and fractional ownership.',
  keywords: ['notary', 'blockchain', 'NFT', 'document verification', 'AI', 'Ethereum'],
  openGraph: {
    title: 'AI Autonomous Notary',
    description: 'Notarize. Tokenize. Govern.',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans bg-navy-900 text-slate-100 min-h-screen`}>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
