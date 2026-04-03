import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case, EvidenceBundle } from '../../types';
import { Shield, Search, ChevronRight, FileText } from 'lucide-react';
import { formatDateTime } from '../../lib/utils';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface BundleWithCase {
  bundle: EvidenceBundle;
  caseData: Case;
}

export const EvidenceBundles: React.FC = () => {
  const navigate = useNavigate();
  const [bundles, setBundles] = React.useState<BundleWithCase[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    caseAdapter.getCases().then(async cases => {
      const casesWithBundles = cases.filter(c => c.evidenceBundleId);
      const results = await Promise.all(
        casesWithBundles.map(async c => {
          const bundle = await caseAdapter.getEvidenceBundle(c.evidenceBundleId!);
          return bundle ? { bundle, caseData: c } : null;
        })
      );
      setBundles(results.filter((r): r is BundleWithCase => r !== null));
      setLoading(false);
    });
  }, []);

  const filtered = bundles.filter(({ bundle, caseData }) =>
    !searchTerm ||
    bundle.bundleId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseData.actId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    caseData.signer.fullName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Evidence Bundles</h2>
          <p className="text-neutral-600 mt-1">
            Sealed cryptographic evidence packages for finalized notarization cases.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search bundles..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Bundles</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1">{bundles.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Artifacts</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1">
            {bundles.reduce((acc, { bundle }) => acc + bundle.artifacts.length, 0)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4">
          <p className="text-xs text-neutral-500 uppercase tracking-wide">Total Size</p>
          <p className="text-3xl font-bold text-neutral-900 mt-1">
            {formatSize(bundles.reduce((acc, { bundle }) => acc + bundle.artifacts.reduce((s, a) => s + a.size, 0), 0))}
          </p>
        </div>
      </div>

      {/* Bundle List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-medium text-neutral-700">No evidence bundles found</h3>
            <p className="text-sm text-neutral-500 mt-1">Bundles are created when cases are finalized.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map(({ bundle, caseData }) => (
              <li key={bundle.bundleId}>
                <button
                  onClick={() => navigate(`/compliance/evidence/${bundle.bundleId}`)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="font-mono text-sm font-medium text-neutral-900">{bundle.bundleId}</code>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600">
                        {bundle.artifacts.length} artifact{bundle.artifacts.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        {caseData.signer.fullName}
                      </span>
                      <span>·</span>
                      <span>{formatDateTime(bundle.createdAt)}</span>
                    </div>
                  </div>
                  <div className={cn(
                    'text-xs px-2 py-1 rounded-full font-medium flex-shrink-0',
                    caseData.humanReviewStatus.state === 'refused'
                      ? 'bg-danger-100 text-danger-700'
                      : 'bg-success-100 text-success-700'
                  )}>
                    {caseData.humanReviewStatus.state === 'refused' ? 'Refused' : 'Sealed'}
                  </div>
                  <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
