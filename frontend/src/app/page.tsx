'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheckIcon, SparklesIcon, CubeIcon, UsersIcon } from '@heroicons/react/24/outline';
import WalletButton from '@/components/wallet-button';

const features = [
  {
    icon: SparklesIcon,
    title: 'AI Validation',
    description:
      'Multi-oracle AI analysis detects fraud signals, extracts entities, and scores document authenticity in seconds.',
    accent: 'cyan',
  },
  {
    icon: ShieldCheckIcon,
    title: 'NFT Seals',
    description:
      'Each notarized document is minted as an ERC-721 NotaryNFT with an immutable on-chain record and EIP-712 signature.',
    accent: 'purple',
  },
  {
    icon: CubeIcon,
    title: 'Fractional Ownership',
    description:
      'Tokenize high-value notarized assets into ERC-1155 shares and trade them on the permissioned marketplace.',
    accent: 'cyan',
  },
  {
    icon: UsersIcon,
    title: 'DAO Governance',
    description:
      'NOTARY_ROLE holders govern policy parameters, fee structures, and oracle onboarding via on-chain proposals.',
    accent: 'purple',
  },
];

const stats = [
  { label: 'Total Value Notarized', value: '$0', sub: 'across all chains' },
  { label: 'Documents Notarized', value: '0', sub: 'lifetime' },
  { label: 'NFTs Minted', value: '0', sub: 'NotaryNFTs' },
  { label: 'Active Notaries', value: '0', sub: 'credentialed professionals' },
];

export default function HomePage() {
  return (
    <div className="bg-hero min-h-screen">
      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-4 pt-32 pb-24">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <span className="badge-verified mb-6 inline-flex">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            Powered by Ethereum &amp; AI Oracles
          </span>

          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight mb-6 leading-none">
            <span className="text-gradient">Notarize.</span>{' '}
            <span className="text-white">Tokenize.</span>{' '}
            <span className="text-gradient">Govern.</span>
          </h1>

          <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10">
            The first fully autonomous notary platform — AI validates your documents, blockchain
            preserves them forever, and NFTs prove ownership on-chain.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/portal" className="btn-primary">
              Launch App →
            </Link>
            <Link href="/verify/0" className="btn-secondary">
              Verify a Document
            </Link>
          </div>
        </motion.div>

        {/* Decorative orbs */}
        <div
          className="absolute top-20 left-10 w-64 h-64 rounded-full opacity-20 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #7c3aed, transparent)' }}
        />
        <div
          className="absolute bottom-10 right-10 w-96 h-96 rounded-full opacity-10 blur-3xl pointer-events-none"
          style={{ background: 'radial-gradient(circle, #00d4ff, transparent)' }}
        />
      </section>

      {/* Stats bar */}
      <section className="px-4 pb-16">
        <div className="max-w-5xl mx-auto glass-card p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <p className="text-2xl font-bold text-gradient">{stat.value}</p>
              <p className="text-sm font-semibold text-slate-200 mt-1">{stat.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{stat.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="px-4 pb-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="section-title">Platform Capabilities</h2>
            <p className="section-subtitle">
              Everything you need for legally-compliant, AI-powered document notarization.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, i) => (
              <motion.div
                key={feature.title}
                className="glass-card-hover p-8"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <div
                  className={`w-12 h-12 rounded-xl flex items-center justify-center mb-5 ${
                    feature.accent === 'cyan'
                      ? 'bg-cyan-400/10 text-cyan-400'
                      : 'bg-purple-500/10 text-purple-400'
                  }`}
                >
                  <feature.icon className="w-6 h-6" />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 pb-24">
        <div className="max-w-3xl mx-auto glass-card p-12 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to notarize your first document?</h2>
          <p className="text-slate-400 mb-8">
            Connect your wallet, upload your document, and receive a legally-binding NFT seal in
            minutes.
          </p>
          <WalletButton />
        </div>
      </section>
    </div>
  );
}
