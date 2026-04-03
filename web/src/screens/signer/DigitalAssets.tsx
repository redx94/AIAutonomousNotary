import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { generateLivingCipherSVG } from '../../lib/livingCipher';
import { getNFTCollection } from '../../services/adapters/nftAdapter';
import { StatusBadge } from '../../components/ui/StatusBadge';
import type { NFTCollection, MintStatus } from '../../types';
import {
  Layers, Gem, Shield, ExternalLink, Copy, Check,
  AlertTriangle, Loader2, Hash, BarChart2, FileText,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function truncateHash(hash: string, chars = 8) {
  if (!hash || hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}…${hash.slice(-chars)}`;
}

/** Wrap the SVG art generator so a bad seed or rendering edge case cannot crash the route. */
function safeCipher(seed: string | undefined, opts: { variant: 'master' | 'page'; pageIndex?: number; size?: number }): string | null {
  try {
    if (!seed) return null;
    return generateLivingCipherSVG(seed, opts);
  } catch (err) {
    console.error('Living Cipher render failed', err);
    return null;
  }
}

function MintStatusBanner({ status }: { status: MintStatus }) {
  if (status === 'MINTED') {
    return (
      <div className="rounded-xl border border-success-200 bg-success-50 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
          <Check className="w-5 h-5 text-success-600" />
        </div>
        <div>
          <p className="font-semibold text-success-900">Collection Minted</p>
          <p className="text-sm text-success-700 mt-0.5">
            Your master NFT and all page assets have been minted and are available below.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'PREPARING' || status === 'MINTING') {
    return (
      <div className="rounded-xl border border-protocol-200 bg-protocol-50 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-protocol-100 flex items-center justify-center flex-shrink-0">
          <Loader2 className="w-5 h-5 text-protocol-600 animate-spin" />
        </div>
        <div>
          <p className="font-semibold text-protocol-900">Collection Preparing</p>
          <p className="text-sm text-protocol-700 mt-0.5">
            Your digital asset collection is being prepared. This may take a moment.
          </p>
        </div>
      </div>
    );
  }
  if (status === 'FAILED') {
    return (
      <div className="rounded-xl border border-warning-200 bg-warning-50 p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-warning-100 flex items-center justify-center flex-shrink-0">
          <AlertTriangle className="w-5 h-5 text-warning-600" />
        </div>
        <div>
          <p className="font-semibold text-warning-900">Mint Failed</p>
          <p className="text-sm text-warning-700 mt-0.5">
            The minting attempt failed. Your legal notarization record is unaffected.
            A retry will be initiated automatically.
          </p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-5 flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-neutral-100 flex items-center justify-center flex-shrink-0">
        <Loader2 className="w-5 h-5 text-neutral-400" />
      </div>
      <div>
        <p className="font-semibold text-neutral-700">Awaiting Finalization</p>
        <p className="text-sm text-neutral-500 mt-0.5">
          Digital asset minting begins after legal finalization completes.
        </p>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="ml-2 text-neutral-400 hover:text-primary-600 transition-colors"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-success-600" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

function HashRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 last:border-0 text-sm">
      <span className="text-neutral-500 flex-shrink-0 w-44">{label}</span>
      <span className="font-mono text-neutral-700 flex items-center">
        {truncateHash(value)}
        <CopyButton text={value} />
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Master NFT Card
// ─────────────────────────────────────────────────────────────────────────────

function MasterNFTCard({ collection }: { collection: NFTCollection }) {
  const { masterAsset } = collection;

  const artDataURI = safeCipher(
    masterAsset?.artSeed ?? collection.artSeed.masterSeed,
    { variant: 'master', size: 360 },
  );

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
      {/* Artwork */}
      <div className="relative bg-neutral-950 flex items-center justify-center" style={{ minHeight: 280 }}>
        {artDataURI ? (
          <img
            src={artDataURI}
            alt="Master Notary NFT — Living Cipher artwork"
            className="w-72 h-72 object-contain"
          />
        ) : (
          <div className="w-72 h-72 flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900">
            <Gem className="w-12 h-12 text-neutral-600" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-xs font-medium">
            <Gem className="w-3.5 h-3.5" />
            Master NFT
          </span>
        </div>
        {masterAsset?.fractionalizationEligible && (
          <div className="absolute top-3 right-3">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-success-600/80 backdrop-blur-sm border border-success-500/30 text-white text-xs font-medium">
              <BarChart2 className="w-3.5 h-3.5" />
              Fractionalization Ready
            </span>
          </div>
        )}
      </div>

      {/* Details */}
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-bold text-neutral-900 text-lg">Master Notary Asset</h3>
            <p className="text-sm text-neutral-500">
              Token #{masterAsset?.tokenId ?? '—'} · Root economic asset
            </p>
          </div>
          <StatusBadge state={masterAsset?.mintStatus ?? 'NOT_STARTED'} />
        </div>

        <div className="space-y-0">
          <HashRow label="Collection ID" value={collection.collectionId} />
          <HashRow label="Document Set Root" value={collection.documentSetRootHash} />
          <HashRow label="Manifest Hash" value={collection.manifestHash} />
          {masterAsset?.artSeed && <HashRow label="Art Seed" value={masterAsset.artSeed} />}
        </div>

        {masterAsset?.mintedAt && (
          <p className="text-xs text-neutral-400 mt-3">
            Minted {new Date(masterAsset.mintedAt).toLocaleString()}
          </p>
        )}

        {masterAsset?.verificationURL && (
          <a
            href={masterAsset.verificationURL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 font-medium"
          >
            View verification record
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Page NFT Gallery
// ─────────────────────────────────────────────────────────────────────────────

function PageNFTCard({
  pageIndex,
  artSeed,
  tokenId,
  pageHash,
  mintedAt,
}: {
  pageIndex: number;
  artSeed: string;
  tokenId?: string;
  pageHash: string;
  mintedAt?: string;
}) {
  const artDataURI = safeCipher(artSeed, { variant: 'page', pageIndex, size: 200 });

  return (
    <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-sm group hover:border-primary-300 hover:shadow-md transition-all">
      <div className="bg-neutral-950 flex items-center justify-center p-4">
        {artDataURI ? (
          <img
            src={artDataURI}
            alt={`Page ${pageIndex + 1} NFT — Living Cipher artwork`}
            className="w-32 h-32 object-contain group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-32 h-32 flex items-center justify-center rounded-lg border border-neutral-700 bg-neutral-900">
            <Layers className="w-8 h-8 text-neutral-600" />
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-neutral-800">
            Page {pageIndex + 1}
          </span>
          {tokenId && (
            <span className="text-xs text-neutral-400 font-mono">#{tokenId}</span>
          )}
        </div>
        <div className="text-xs font-mono text-neutral-500 truncate flex items-center gap-1">
          <Hash className="w-3 h-3 flex-shrink-0" />
          {truncateHash(pageHash, 6)}
        </div>
        {mintedAt && (
          <p className="text-xs text-neutral-400 mt-1">
            {new Date(mintedAt).toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Authority Boundary Notice
// ─────────────────────────────────────────────────────────────────────────────

function AuthorityNotice() {
  return (
    <div className="rounded-xl border border-neutral-200 bg-neutral-50 p-4 flex items-start gap-3">
      <Shield className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
      <div className="text-sm text-neutral-600">
        <span className="font-semibold text-neutral-800">Authority boundary:</span>{' '}
        Legal notarization was finalized off-chain under human-supervised authority.
        These NFTs are the secure digital asset layer — downstream cryptographic proof
        and collectible artifacts. They do not constitute or replace the legal record.
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────

export const DigitalAssets: React.FC = () => {
  const { caseId: routeCaseId } = useParams<{ caseId?: string }>();
  const caseId = routeCaseId ?? 'act-published-006';

  const [collection, setCollection] = useState<NFTCollection | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getNFTCollection(caseId)
      .then(c => {
        setCollection(c ?? null);
        setLoading(false);
      })
      .catch(() => {
        setError('Failed to load digital asset collection.');
        setLoading(false);
      });
  }, [caseId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto flex items-center justify-center min-h-96">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    );
  }

  if (error || !collection) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="rounded-xl border border-danger-200 bg-danger-50 p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-danger-500 mx-auto mb-2" />
          <p className="text-danger-800 font-medium">
            {error ?? 'No digital asset collection found for this case.'}
          </p>
          <Link
            to="/signer/final"
            className="mt-4 inline-block text-sm text-primary-600 hover:underline"
          >
            ← Back to Final Package
          </Link>
        </div>
      </div>
    );
  }

  const isMinted = collection.mintStatus === 'MINTED';

  return (
    <div className="max-w-5xl mx-auto space-y-8">

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          <Link to="/signer/final" className="hover:text-primary-600">Final Package</Link>
          <span>/</span>
          <span>Digital Assets</span>
        </div>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
              <Layers className="w-6 h-6 text-primary-600" />
              Digital Asset Collection
            </h2>
            <p className="text-neutral-500 mt-1">
              Session-unique NFT collection for case{' '}
              <span className="font-mono text-xs bg-neutral-100 px-1.5 py-0.5 rounded">
                {collection.caseId}
              </span>
            </p>
          </div>
          <StatusBadge state={collection.mintStatus} size="lg" />
        </div>
      </div>

      {/* Authority notice */}
      <AuthorityNotice />

      {/* Mint status banner */}
      <MintStatusBanner status={collection.mintStatus} />

      {/* Collection manifest summary */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-500" />
          Collection Manifest
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div className="space-y-0">
            <HashRow label="Collection ID" value={collection.collectionId} />
            <HashRow label="Session ID" value={collection.sessionId} />
            <HashRow label="Root Hash" value={collection.documentSetRootHash} />
          </div>
          <div className="space-y-0">
            <HashRow label="Manifest Hash" value={collection.manifestHash} />
            <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 text-sm">
              <span className="text-neutral-500 w-44">Page Count</span>
              <span className="font-mono text-neutral-700">{collection.pageCount}</span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 text-sm">
              <span className="text-neutral-500 w-44">Fractionalization</span>
              <span className={cn(
                'text-sm font-medium',
                collection.fractionalizationEligible ? 'text-success-600' : 'text-neutral-400',
              )}>
                {collection.fractionalizationEligible ? 'Eligible (Master NFT)' : 'Not eligible'}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 border-b border-neutral-100 text-sm">
              <span className="text-neutral-500 w-44">Publication</span>
              <span className="font-mono text-neutral-700 capitalize">
                {collection.publicationStatus ?? 'none'}
              </span>
            </div>
          </div>
        </div>
        {collection.registeredAt && (
          <p className="text-xs text-neutral-400 mt-3">
            Collection registered {new Date(collection.registeredAt).toLocaleString()}
            {collection.mintedAt && (
              <> · minted {new Date(collection.mintedAt).toLocaleString()}</>
            )}
          </p>
        )}
      </div>

      {/* Master NFT */}
      {isMinted && collection.masterAsset && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-900 mb-3 flex items-center gap-2">
            <Gem className="w-5 h-5 text-primary-600" />
            Master Notary Asset NFT
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            The root legal and economic token for this notarized document set.
            Eligible for fractionalization into tradeable fraction shares.
          </p>
          <MasterNFTCard collection={collection} />
        </section>
      )}

      {/* Page NFT Gallery */}
      {isMinted && collection.pageAssets.length > 0 && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-900 mb-1 flex items-center gap-2">
            <Layers className="w-5 h-5 text-neutral-600" />
            Page Collection
            <span className="text-sm font-normal text-neutral-400">
              ({collection.pageAssets.length} assets)
            </span>
          </h3>
          <p className="text-sm text-neutral-500 mb-4">
            Provenance and collectible sub-assets for each page of the notarized document
            set. Visually related to the master NFT; unique per page.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {collection.pageAssets.map(page => (
              <PageNFTCard
                key={page.tokenId}
                pageIndex={page.pageIndex}
                artSeed={page.artSeed}
                tokenId={page.tokenId}
                pageHash={page.pageHash}
                mintedAt={page.mintedAt}
              />
            ))}
          </div>
        </section>
      )}

      {/* Preparing placeholder */}
      {!isMinted && collection.mintStatus !== 'NOT_STARTED' && (
        <section>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Preview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 opacity-40 pointer-events-none select-none">
            {Array.from({ length: Math.max(collection.pageCount, 1) }).map((_, i) => (
              <div
                key={i}
                className="bg-neutral-100 rounded-xl border border-dashed border-neutral-300 flex items-center justify-center"
                style={{ minHeight: 160 }}
              >
                <Loader2 className="w-6 h-6 text-neutral-400 animate-spin" />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Back link */}
      <div className="pt-2">
        <Link
          to="/signer/final"
          className="text-sm text-primary-600 hover:text-primary-800 font-medium"
        >
          ← Back to Final Package
        </Link>
      </div>
    </div>
  );
};
