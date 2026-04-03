import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case } from '../../types';
import { Shield, FileText, ChevronRight, Search } from 'lucide-react';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export const NotaryEvidence: React.FC = () => {
  const navigate = useNavigate();
  const [cases, setCases] = React.useState<Case[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    caseAdapter.getCases().then(cs => {
      setCases(cs.filter(c => c.evidenceBundleId));
      setLoading(false);
    });
  }, []);

  const filtered = cases.filter(c =>
    !searchTerm ||
    c.actId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.signer.fullName.toLowerCase().includes(searchTerm.toLowerCase())
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Evidence Packages</h2>
          <p className="text-neutral-600 mt-1">
            Review sealed evidence bundles associated with completed notarization cases.
          </p>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search cases..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Authority Notice */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-primary-800">
          <span className="font-medium">Notary Role — Read-Only Evidence Access.</span>{' '}
          Evidence bundles are sealed artifacts. Full bundle inspection is available in the Compliance portal.
        </p>
      </div>

      {/* Evidence List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <Shield className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <h3 className="font-medium text-neutral-700">No evidence bundles found</h3>
            <p className="text-sm text-neutral-500 mt-1">Cases with sealed evidence bundles will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {filtered.map(c => (
              <li key={c.actId}>
                <button
                  onClick={() => navigate(`/notary/case/${c.actId}`)}
                  className="w-full flex items-center gap-4 px-6 py-4 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                    <Shield className="w-5 h-5 text-primary-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-neutral-900">{c.signer.fullName}</p>
                      <span className={cn(
                        'text-xs px-2 py-0.5 rounded-full font-medium',
                        c.humanReviewStatus.state === 'refused'
                          ? 'bg-danger-100 text-danger-700'
                          : 'bg-success-100 text-success-700'
                      )}>
                        {c.humanReviewStatus.state === 'refused' ? 'Refused' : 'Finalized'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-sm text-neutral-500">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        <code className="font-mono text-xs">{c.actId}</code>
                      </span>
                      <span>·</span>
                      <span>{formatDate(c.timestamps.createdAt)}</span>
                      <span>·</span>
                      <span className="capitalize">{c.actType} · {c.jurisdiction}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-neutral-500 flex-shrink-0">
                    <code className="font-mono text-xs text-neutral-400">{c.evidenceBundleId}</code>
                    <ChevronRight className="w-4 h-4" />
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
