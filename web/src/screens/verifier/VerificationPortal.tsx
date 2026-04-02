import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { EvidenceIntegrityCard } from '../../components/evidence/EvidenceIntegrityCard';
import * as verificationAdapter from '../../services/adapters/verificationAdapter';
import type { VerificationResult, CaseState } from '../../types';
import {
  Search, Upload, FileCheck, CheckCircle2,
  XCircle, FileText, Hash, Clock, AlertCircle,
} from 'lucide-react';

function legalStatusToState(r: VerificationResult): CaseState {
  if (r.status === 'refused') return 'REFUSED';
  if (r.legalStatus === 'finalized_and_published') return 'PUBLISHED';
  if (r.legalStatus === 'publication_failed') return 'PUBLICATION_FAILED';
  if (r.legalStatus === 'finalized_offchain') return 'FINALIZED_OFFCHAIN';
  return 'REFUSED';
}

export const VerificationPortal: React.FC = () => {
  const [searchType, setSearchType] = React.useState<'document' | 'hash' | 'case'>('document');
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [result, setResult] = React.useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    setIsSearching(true);
    setResult(null);
    try {
      let r: VerificationResult;
      if (searchType === 'case') {
        r = await verificationAdapter.verifyByCaseId(searchValue);
      } else {
        // hash or document upload both go through hash lookup
        r = await verificationAdapter.verifyByHash(searchValue || '0x');
      }
      setResult(r);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <FileCheck className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-3xl font-semibold text-neutral-900">Verify a Notarization</h2>
        <p className="text-neutral-600 mt-2">
          Confirm the authenticity of any document notarized on our platform.
          No account required.
        </p>
      </div>

      {/* Search Box */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 mb-8">
        <div className="flex gap-2 mb-6">
          {[
            { id: 'document', label: 'Upload Document', icon: Upload },
            { id: 'hash', label: 'Enter Hash', icon: Hash },
            { id: 'case', label: 'Case ID', icon: FileText },
          ].map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setSearchType(type.id as typeof searchType)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  searchType === type.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-3">
          {searchType === 'document' ? (
            <div className="flex-1 border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-600">Drop your document here or click to browse</p>
              <p className="text-xs text-neutral-400 mt-1">Document hash will be computed locally</p>
            </div>
          ) : (
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchValue && handleVerify()}
              placeholder={
                searchType === 'hash'
                  ? 'Enter document hash (0x... or sha256:...)'
                  : 'Enter case ID (act-...)'
              }
              className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          )}
          <button
            onClick={handleVerify}
            disabled={isSearching || (searchType !== 'document' && !searchValue)}
            className={cn(
              'px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2 transition-colors',
              isSearching || (searchType !== 'document' && !searchValue)
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            {isSearching ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Verify
              </>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {result && (
        <div className="space-y-6">
          {/* verified */}
          {result.status === 'verified' && (
            <>
              <div className="bg-success-50 rounded-xl border border-success-200 p-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2 className="w-7 h-7 text-success-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-success-900">Document Verified</h3>
                    <p className="text-success-700 mt-1">
                      This document matches the notarization record. The notarization is authentic.
                    </p>
                    <div className="mt-3 flex items-center gap-3">
                      <StatusBadge state={legalStatusToState(result)} size="md" />
                      {result.notarizationTime && (
                        <span className="text-sm text-success-700">
                          {new Date(result.notarizationTime).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Legal status and publication as separate panels */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LegalStatusCard
                  state={legalStatusToState(result)}
                  finalizedAt={result.notarizationTime}
                  authorityProvider={result.authorityMode}
                />
                <ProtocolPublicationLabel
                  state={legalStatusToState(result)}
                  context="banner"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl border border-neutral-200 p-5">
                  <h4 className="font-semibold text-neutral-900 mb-4">Notarization Details</h4>
                  <div className="space-y-3 text-sm">
                    {[
                      { label: 'Case ID', value: result.caseId, mono: true },
                      { label: 'Jurisdiction', value: result.jurisdiction },
                      { label: 'Authority Mode', value: result.authorityMode === 'human_commissioned' ? 'Human Commissioned' : 'Autonomous' },
                      { label: 'Legal Status', value: result.legalStatus?.replace(/_/g, ' ') },
                      { label: 'Publication Status', value: result.publicationStatus ?? '—' },
                    ].map((row) => (
                      <div key={row.label} className="flex justify-between">
                        <span className="text-neutral-500">{row.label}</span>
                        {row.mono
                          ? <code className="text-xs font-mono text-neutral-700">{row.value}</code>
                          : <span className="font-medium text-neutral-700 capitalize">{row.value}</span>
                        }
                      </div>
                    ))}
                  </div>
                </div>

                {result.documentHash && (
                  <EvidenceIntegrityCard
                    bundleId={result.caseId ?? '—'}
                    contentHash={result.documentHash}
                    createdAt={result.notarizationTime ?? new Date().toISOString()}
                    artifactCount={9}
                  />
                )}
              </div>

              <div className="bg-white rounded-xl border border-neutral-200 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                      <FileText className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-900">Verification Certificate</h4>
                      <p className="text-sm text-neutral-600">Download a PDF certificate of this verification result</p>
                    </div>
                  </div>
                  <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
                    Download
                  </button>
                </div>
              </div>
            </>
          )}

          {/* refused */}
          {result.status === 'refused' && (
            <div className="bg-danger-50 rounded-xl border border-danger-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-danger-500" />
              </div>
              <h3 className="text-lg font-semibold text-danger-900">Notarization Refused</h3>
              <p className="text-danger-700 mt-2">
                This notarization was refused by the commissioned authority. No legal validity is conferred.
              </p>
              {result.caseId && (
                <p className="text-xs font-mono text-danger-500 mt-3">{result.caseId}</p>
              )}
            </div>
          )}

          {/* not_found */}
          {result.status === 'not_found' && (
            <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-neutral-900">Notarization Not Found</h3>
              <p className="text-neutral-600 mt-2">
                No notarization record was found for the provided identifier.
                The document may not have been notarized on this platform, or the details may be incorrect.
              </p>
            </div>
          )}

          {/* altered */}
          {result.status === 'altered' && (
            <div className="bg-danger-50 rounded-xl border border-danger-200 p-8 text-center">
              <div className="w-16 h-16 rounded-full bg-danger-100 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-danger-500" />
              </div>
              <h3 className="text-lg font-semibold text-danger-900">Document Altered</h3>
              <p className="text-danger-700 mt-2">
                The document hash does not match the original notarization record.
                This document appears to have been modified after notarization.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Info Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            icon: FileCheck, title: 'Document Integrity',
            desc: 'We verify the document hash against the sealed notarization record.',
          },
          {
            icon: Clock, title: 'Legal Status',
            desc: 'Legal authority is established at off-chain finalization, not blockchain publication.',
          },
          {
            icon: Hash, title: 'Protocol Attestation',
            desc: 'Optional on-chain publication provides supplementary cryptographic proof.',
          },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="text-center p-6">
            <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
              <Icon className="w-6 h-6 text-primary-600" />
            </div>
            <h4 className="font-medium text-neutral-900">{title}</h4>
            <p className="text-sm text-neutral-600 mt-2">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
