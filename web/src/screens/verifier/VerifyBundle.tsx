import React from 'react';
import { cn } from '../../lib/utils';
import * as verificationAdapter from '../../services/adapters/verificationAdapter';
import type { VerificationResult } from '../../types';
import { Shield, Search, CheckCircle2, XCircle, AlertCircle, FileText } from 'lucide-react';

const SAMPLE_BUNDLES = [
  { bundleId: 'bundle-006', caseId: 'act-published-006', label: 'Published Case Bundle' },
  { bundleId: 'bundle-005', caseId: 'act-finalized-005', label: 'Finalized Off-chain Bundle' },
];

export const VerifyBundle: React.FC = () => {
  const [bundleId, setBundleId] = React.useState('');
  const [isVerifying, setIsVerifying] = React.useState(false);
  const [result, setResult] = React.useState<VerificationResult | null>(null);

  const handleVerify = async () => {
    if (!bundleId.trim()) return;
    setIsVerifying(true);
    setResult(null);
    try {
      // Use caseId from bundle lookup; for demo, map known bundle IDs
      const sample = SAMPLE_BUNDLES.find(b => b.bundleId === bundleId.trim() || b.caseId === bundleId.trim());
      const r = await verificationAdapter.verifyByCaseId(sample?.caseId ?? bundleId.trim());
      setResult(r);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSample = (b: typeof SAMPLE_BUNDLES[0]) => {
    setBundleId(b.bundleId);
    setResult(null);
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-3xl font-semibold text-neutral-900">Verify Evidence Bundle</h2>
        <p className="text-neutral-600 mt-2">
          Confirm the cryptographic integrity of a sealed evidence bundle by its bundle ID.
        </p>
      </div>

      {/* Search */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 space-y-4">
        <label className="block text-sm font-medium text-neutral-700">
          Bundle ID or Case ID
        </label>
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="e.g. bundle-006 or act-published-006"
              value={bundleId}
              onChange={e => setBundleId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              className="w-full pl-10 pr-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            />
          </div>
          <button
            onClick={handleVerify}
            disabled={!bundleId.trim() || isVerifying}
            className={cn(
              'px-6 py-3 rounded-lg font-medium text-sm transition-colors',
              bundleId.trim() && !isVerifying
                ? 'bg-primary-600 text-white hover:bg-primary-700'
                : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
            )}
          >
            {isVerifying ? 'Verifying…' : 'Verify'}
          </button>
        </div>

        {/* Sample bundles */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-neutral-500">Try a sample:</span>
          {SAMPLE_BUNDLES.map(b => (
            <button
              key={b.bundleId}
              onClick={() => handleSample(b)}
              className="text-xs px-2 py-1 border border-neutral-300 rounded-md text-neutral-600 hover:bg-neutral-50 font-mono transition-colors"
            >
              {b.bundleId}
            </button>
          ))}
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={cn(
          'rounded-xl border p-6 space-y-4',
          result.status === 'verified' ? 'border-success-200 bg-success-50' :
          result.status === 'refused' ? 'border-danger-200 bg-danger-50' :
          'border-warning-200 bg-warning-50'
        )}>
          <div className="flex items-center gap-3">
            {result.status === 'verified' ? (
              <CheckCircle2 className="w-6 h-6 text-success-600 flex-shrink-0" />
            ) : result.status === 'refused' ? (
              <XCircle className="w-6 h-6 text-danger-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-6 h-6 text-warning-600 flex-shrink-0" />
            )}
            <div>
              <p className={cn(
                'font-semibold text-lg',
                result.status === 'verified' ? 'text-success-800' :
                result.status === 'refused' ? 'text-danger-800' : 'text-warning-800'
              )}>
                {result.status === 'verified' ? 'Bundle Integrity Confirmed' :
                 result.status === 'refused' ? 'Case Was Refused' :
                 result.status === 'not_found' ? 'Bundle Not Found' : 'Integrity Check Failed'}
              </p>
              <p className={cn(
                'text-sm mt-0.5',
                result.status === 'verified' ? 'text-success-700' :
                result.status === 'refused' ? 'text-danger-700' : 'text-warning-700'
              )}>
                {result.status === 'verified'
                  ? 'The evidence bundle is authentic and has not been tampered with.'
                  : result.status === 'not_found'
                  ? 'No bundle was found with the provided ID.'
                  : 'This case was refused by the notary.'}
              </p>
            </div>
          </div>

          {result.status === 'verified' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-success-200">
              {result.caseId && (
                <div>
                  <p className="text-xs text-success-600 uppercase tracking-wide">Case ID</p>
                  <code className="text-sm font-mono text-success-800">{result.caseId}</code>
                </div>
              )}
              {result.authorityMode && (
                <div>
                  <p className="text-xs text-success-600 uppercase tracking-wide">Authority Mode</p>
                  <p className="text-sm text-success-800 capitalize">{result.authorityMode.replace(/_/g, ' ')}</p>
                </div>
              )}
              {result.notarizationTime && (
                <div>
                  <p className="text-xs text-success-600 uppercase tracking-wide">Notarized At</p>
                  <p className="text-sm text-success-800">{new Date(result.notarizationTime).toLocaleString()}</p>
                </div>
              )}
              {result.legalStatus && (
                <div>
                  <p className="text-xs text-success-600 uppercase tracking-wide">Legal Status</p>
                  <p className="text-sm text-success-800 capitalize">{result.legalStatus.replace(/_/g, ' ')}</p>
                </div>
              )}
              {result.bundleStatus && (
                <div>
                  <p className="text-xs text-success-600 uppercase tracking-wide">Bundle Status</p>
                  <p className="text-sm text-success-800 capitalize">{result.bundleStatus}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 flex items-start gap-3">
        <FileText className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-neutral-600 space-y-1">
          <p className="font-medium text-neutral-700">About Evidence Bundles</p>
          <p>
            An evidence bundle is a sealed cryptographic package containing all artifacts from a
            notarization: the signed document, identity records, AI analysis, ceremony recording,
            and the notary's digital seal. Each bundle has a unique ID and content hash.
          </p>
        </div>
      </div>
    </div>
  );
};
