import React from 'react';
// import { cn } from '../../lib/utils';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { EvidenceIntegrityCard } from '../../components/evidence/EvidenceIntegrityCard';
import { CheckCircle2, Download, Share2, FileText, ExternalLink, Gem, Layers, ArrowRight } from 'lucide-react';

export const FinalPackage: React.FC = () => {
  // Mock finalized case
  const caseData = {
    actId: 'act-published-006',
    documentType: 'affidavit',
    actType: 'oath',
    jurisdiction: 'US',
    signer: { fullName: 'Robert Davis' },
    timestamps: {
      createdAt: '2026-03-31T14:00:00Z',
      finalizedAt: '2026-03-31T16:45:00Z',
    },
  };
  
  const evidenceBundle = {
    bundleId: 'bundle-006-8f7d3a',
    contentHash: 'sha256:a1b2c3d4e5f6...',
    createdAt: '2026-03-31T16:45:00Z',
    artifactCount: 9,
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900">Your Notarization is Complete</h2>
        <p className="text-neutral-600 mt-1">
          Your document has been successfully notarized. Download your certificate and evidence package below.
        </p>
      </div>
      
      {/* Success Banner */}
      <div className="bg-success-50 rounded-xl border border-success-200 p-6 mb-6">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-7 h-7 text-success-600" />
          </div>
          <div>
            <h3 className="text-xl font-semibold text-success-900">Notarization Complete</h3>
            <p className="text-success-700 mt-1">
              Your document has been notarized under human-supervised authority. 
              Your legal record is complete and valid.
            </p>
            <div className="mt-3 flex items-center gap-4">
              <StatusBadge state="PUBLISHED" size="md" />
              <span className="text-sm text-success-700">
                Finalized {new Date(caseData.timestamps.finalizedAt).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Legal Status */}
      <div className="mb-6">
        <LegalStatusCard 
          state="PUBLISHED" 
          finalizedAt={caseData.timestamps.finalizedAt}
          authorityProvider="human_commissioned"
        />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Evidence Bundle */}
        <EvidenceIntegrityCard 
          bundleId={evidenceBundle.bundleId}
          contentHash={evidenceBundle.contentHash}
          createdAt={evidenceBundle.createdAt}
          artifactCount={evidenceBundle.artifactCount}
        />
        
        {/* Protocol Status */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5">
          <h4 className="font-semibold text-neutral-900 mb-4">Protocol Publication</h4>
          <ProtocolPublicationLabel state="PUBLISHED" context="banner" />
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Transaction Hash</span>
              <code className="font-mono text-neutral-700">0xabc...def</code>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Published</span>
              <span className="text-neutral-700">{new Date(caseData.timestamps.finalizedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Downloads */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Download Your Documents</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <FileText className="w-5 h-5 text-neutral-600 group-hover:text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 text-sm">Notarized Document</p>
              <p className="text-xs text-neutral-500">PDF • 2.4 MB</p>
            </div>
            <Download className="w-4 h-4 text-neutral-400 group-hover:text-primary-600" />
          </a>
          
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <FileText className="w-5 h-5 text-neutral-600 group-hover:text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 text-sm">Certificate</p>
              <p className="text-xs text-neutral-500">PDF • 156 KB</p>
            </div>
            <Download className="w-4 h-4 text-neutral-400 group-hover:text-primary-600" />
          </a>
          
          <a
            href="#"
            className="flex items-center gap-3 p-4 bg-neutral-50 rounded-lg border border-neutral-200 hover:border-primary-300 hover:bg-primary-50 transition-colors group"
          >
            <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center group-hover:bg-primary-100 transition-colors">
              <FileText className="w-5 h-5 text-neutral-600 group-hover:text-primary-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-neutral-900 text-sm">Evidence Bundle</p>
              <p className="text-xs text-neutral-500">ZIP • 12.5 MB</p>
            </div>
            <Download className="w-4 h-4 text-neutral-400 group-hover:text-primary-600" />
          </a>
        </div>
      </div>
      
      {/* Verification Link */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
            <Share2 className="w-6 h-6 text-primary-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-neutral-900">Share Verification Link</h3>
            <p className="text-sm text-neutral-600 mt-1">
              Anyone with this link can verify the authenticity of your notarization 
              without needing an account.
            </p>
            <div className="mt-4 flex gap-3">
              <code className="flex-1 px-3 py-2 bg-neutral-100 rounded-lg text-sm font-mono text-neutral-700 truncate">
                https://ainotary.example.com/verify/{caseData.actId}
              </code>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium text-sm hover:bg-primary-700 transition-colors">
                Copy
              </button>
              <a
                href={`/verify/${caseData.actId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg font-medium text-sm hover:bg-neutral-50 transition-colors inline-flex items-center gap-1"
              >
                View
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Digital Asset Collection */}
      <div className="bg-gradient-to-br from-neutral-950 to-neutral-800 rounded-xl border border-neutral-700 p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
            <Gem className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1 flex-wrap">
              <h3 className="font-semibold text-white">Digital Asset Collection</h3>
              <StatusBadge state="NFT_MINTED" size="sm" />
            </div>
            <p className="text-sm text-neutral-300 mt-1">
              Your notarization has been assetized into a session-unique NFT collection —
              a master notary asset and page-level provenance tokens.
              The master NFT is eligible for fractionalization.
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              <div className="bg-white/10 rounded-lg p-3">
                <Gem className="w-5 h-5 text-white mx-auto mb-1" />
                <p className="text-white font-bold text-lg">1</p>
                <p className="text-neutral-400 text-xs">Master NFT</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <Layers className="w-5 h-5 text-white mx-auto mb-1" />
                <p className="text-white font-bold text-lg">3</p>
                <p className="text-neutral-400 text-xs">Page NFTs</p>
              </div>
              <div className="bg-white/10 rounded-lg p-3">
                <FileText className="w-5 h-5 text-white mx-auto mb-1" />
                <p className="text-white font-bold text-lg">1</p>
                <p className="text-neutral-400 text-xs">Collection</p>
              </div>
            </div>
            <div className="mt-4">
              <Link
                to={`/signer/assets/${caseData.actId}`}
                className="inline-flex items-center gap-2 px-4 py-2 bg-white text-neutral-900 rounded-lg font-medium text-sm hover:bg-neutral-100 transition-colors"
              >
                View Digital Asset Collection
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
