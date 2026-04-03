import React from 'react';
import { cn } from '../../lib/utils';
import * as verificationAdapter from '../../services/adapters/verificationAdapter';
import type { VerificationResult } from '../../types';
import { Globe, Search, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const SAMPLE_CASES = [
  { caseId: 'act-published-006', label: 'Published' },
  { caseId: 'act-pubfail-008', label: 'Failed' },
  { caseId: 'act-finalized-005', label: 'Off-chain only' },
];

export const PublicationStatus: React.FC = () => {
  const [caseId, setCaseId] = React.useState('');
  const [isChecking, setIsChecking] = React.useState(false);
  const [result, setResult] = React.useState<VerificationResult | null>(null);

  const handleCheck = async () => {
    if (!caseId.trim()) return;
    setIsChecking(true);
    setResult(null);
    try {
      const r = await verificationAdapter.verifyByCaseId(caseId.trim());
      setResult(r);
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Globe className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-3xl font-semibold text-neutral-900">Publication Status</h2>
        <p className="text-neutral-600 mt-2">
          Check whether a notarization has been published to the protocol and confirm
          its on-chain or off-chain finalization status.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <label className="block text-sm font-medium text-neutral-700">Case ID</label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. act-published-006"
              value={caseId}
              onChange={e => setCaseId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <button
            onClick={handleCheck}
            disabled={!caseId.trim() || isChecking}
            className={cn(
              'px-6 py-3 rounded-lg font-medium text-sm transition-colors',
              caseId.trim() && !isChecking
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            )}
          >
            {isChecking ? 'Checking…' : 'Check'}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-500">Try a sample:</span>
          {SAMPLE_CASES.map(s => (
            <button
              key={s.caseId}
              onClick={() => { setCaseId(s.caseId); setResult(null); }}
              className="text-xs px-2 py-1 border border-neutral-300 rounded-md text-neutral-600 hover:bg-neutral-50 font-mono transition-colors"
            >
              {s.caseId} <span className="text-neutral-400 font-sans">({s.label})</span>
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className={cn(
            'px-6 py-4 flex items-center gap-3',
            result.publicationStatus === 'published' || result.legalStatus === 'finalized_and_published'
              ? 'bg-success-50 border-b border-success-100'
              : result.legalStatus === 'publication_failed'
              ? 'bg-danger-50 border-b border-danger-100'
              : 'bg-warning-50 border-b border-warning-100'
          )}>
            {result.legalStatus === 'finalized_and_published' ? (
              <CheckCircle2 className="w-6 h-6 text-success-600 flex-shrink-0" />
            ) : result.legalStatus === 'publication_failed' ? (
              <XCircle className="w-6 h-6 text-danger-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-warning-600 flex-shrink-0" />
            )}
            <div>
              <p className="font-semibold text-neutral-900">
                {result.legalStatus === 'finalized_and_published'
                  ? 'Published to Protocol'
                  : result.legalStatus === 'publication_failed'
                  ? 'Publication Failed'
                  : result.legalStatus === 'finalized_offchain'
                  ? 'Finalized Off-Chain (Not Published)'
                  : result.status === 'not_found'
                  ? 'Case Not Found'
                  : 'Case Refused'}
              </p>
              <p className="text-sm text-neutral-500 mt-0.5">
                {result.legalStatus === 'finalized_and_published'
                  ? 'This notarization has been published to the public protocol ledger.'
                  : result.legalStatus === 'publication_failed'
                  ? 'Publication was attempted but failed. The record is finalized off-chain only.'
                  : result.legalStatus === 'finalized_offchain'
                  ? 'The notarization is legally finalized but not published to the protocol.'
                  : 'No publication record found for this case ID.'}
              </p>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            {result.caseId && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Case ID</p>
                <code className="font-mono text-neutral-900">{result.caseId}</code>
              </div>
            )}
            {result.authorityMode && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Authority Mode</p>
                <p className="text-neutral-900 capitalize">{result.authorityMode.replace(/_/g, ' ')}</p>
              </div>
            )}
            {result.notarizationTime && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Finalized At</p>
                <p className="text-neutral-900">{new Date(result.notarizationTime).toLocaleString()}</p>
              </div>
            )}
            {result.jurisdiction && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Jurisdiction</p>
                <p className="text-neutral-900">{result.jurisdiction}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Legal Status</p>
              <p className="text-neutral-900 capitalize">
                {result.legalStatus?.replace(/_/g, ' ') ?? 'Unknown'}
              </p>
            </div>
            {result.publicationStatus && (
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Publication Status</p>
                <p className="text-neutral-900 capitalize">{result.publicationStatus}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5 text-sm text-neutral-600 space-y-2">
        <p className="font-medium text-neutral-700">About Protocol Publication</p>
        <p>
          After a notarization is finalized off-chain, compliance may elect to publish the evidence
          bundle hash to the public protocol ledger. Publication is irreversible and creates a
          permanent, auditable public record. Off-chain finalization is legally binding regardless
          of publication status.
        </p>
      </div>
    </div>
  );
};
