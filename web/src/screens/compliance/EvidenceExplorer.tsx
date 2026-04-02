import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { EvidenceBundle } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { ChevronLeft, Shield, FileText, AlertCircle } from 'lucide-react';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const EvidenceExplorer: React.FC = () => {
  const { bundleId } = useParams<{ bundleId: string }>();
  const navigate = useNavigate();

  const [bundle, setBundle] = React.useState<EvidenceBundle | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!bundleId) { setLoading(false); return; }
    caseAdapter.getEvidenceBundle(bundleId).then(b => {
      setBundle(b ?? null);
      setLoading(false);
    });
  }, [bundleId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-700">Evidence bundle not found</h3>
        <p className="text-neutral-500 mt-2">The bundle ID <code className="font-mono">{bundleId}</code> does not exist in the current data set.</p>
        <button onClick={() => navigate('/compliance')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          Back to Ledger
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 text-sm mb-2">
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="text-2xl font-semibold text-neutral-900">Evidence Bundle</h2>
        <code className="text-sm font-mono text-neutral-500">{bundle.bundleId}</code>
      </div>

      {/* Integrity Banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800">
          <p className="font-medium">Integrity-Verified Evidence Package</p>
          <p className="mt-1">
            All artifact hashes are computed at time of creation and sealed in the bundle manifest.
            Legal validity is established by human authority execution, not by publication.
            This package provides the verifiable audit trail.
          </p>
        </div>
      </div>

      {/* Manifest Summary */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Manifest</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Case ID', value: bundle.manifest.caseId, mono: true },
            { label: 'Bundle ID', value: bundle.manifest.bundleId, mono: true },
            { label: 'Artifact Count', value: String(bundle.manifest.artifactCount) },
            { label: 'Created', value: formatDateTime(bundle.manifest.createdAt) },
          ].map((item) => (
            <div key={item.label} className="bg-neutral-50 rounded-lg p-3">
              <p className="text-xs text-neutral-500 mb-1">{item.label}</p>
              {item.mono
                ? <code className="text-xs font-mono text-neutral-800 break-all">{item.value}</code>
                : <p className="text-sm font-medium text-neutral-800">{item.value}</p>
              }
            </div>
          ))}
        </div>
        <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
          <p className="text-xs text-neutral-500 mb-1">Bundle Content Hash</p>
          <code className="text-xs font-mono text-neutral-800 break-all">{bundle.manifest.contentHash}</code>
        </div>
      </div>

      {/* Artifacts Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-semibold text-neutral-900">Artifacts ({bundle.artifacts.length})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">File</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Hash</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Created By</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {bundle.artifacts.map((art) => (
                <tr key={art.artifactId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <FileText className="w-3.5 h-3.5 text-neutral-400" />
                      <span className="text-neutral-700 capitalize">{art.artifactType.replace(/-/g, ' ')}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-neutral-700">{art.fileName}</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-neutral-600">{formatSize(art.size)}</span>
                  </td>
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-neutral-500">{art.hash.slice(0, 20)}…</code>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-neutral-600">{art.createdBy}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-sm text-neutral-600">{formatDateTime(art.createdAt)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {bundle.artifacts.length === 0 && (
            <div className="p-8 text-center text-neutral-500 text-sm">No artifacts in this bundle.</div>
          )}
        </div>
      </div>
    </div>
  );
};
