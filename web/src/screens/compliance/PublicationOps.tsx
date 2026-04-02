import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case, AuthorityExecution, CaseState } from '../../types';
import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { formatDateTime } from '../../lib/utils';
import { ChevronLeft, AlertCircle, CheckCircle2, RefreshCw, Shield } from 'lucide-react';

function deriveState(c: Case): CaseState {
  if (c.humanReviewStatus.state === 'refused') return 'REFUSED';
  if (c.timestamps.finalizedAt) return 'FINALIZED_OFFCHAIN';
  if (c.ceremonyStatus.state === 'completed') return 'CEREMONY_COMPLETE';
  if (c.humanReviewStatus.state === 'completed') return 'REVIEW_COMPLETE';
  return 'DRAFT';
}

// Map case ID to expected execution ID in demo data
function inferExecutionId(actId: string): string {
  const seg = actId.split('-')[2] ?? '';
  return `exec-${seg}`;
}

export const PublicationOps: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [execution, setExecution] = React.useState<AuthorityExecution | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!caseId) { setLoading(false); return; }
    caseAdapter.getCase(caseId).then(async c => {
      setCaseData(c || null);
      if (c) {
        const execId = inferExecutionId(c.actId);
        const exec = await caseAdapter.getAuthorityExecution(execId);
        setExecution(exec || null);
      }
    }).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="text-center py-16">
        <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-700">Case not found</h3>
        <button onClick={() => navigate('/compliance')} className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700">
          Back to Ledger
        </button>
      </div>
    );
  }

  const caseState = deriveState(caseData);
  const pubStatus = execution?.publicationStatus ?? null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <button onClick={() => navigate(`/compliance/case/${caseData.actId}`)} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 text-sm mb-2">
          <ChevronLeft className="w-4 h-4" />
          Back to Case
        </button>
        <h2 className="text-2xl font-semibold text-neutral-900">Publication Operations</h2>
        <code className="text-sm font-mono text-neutral-500">{caseData.actId}</code>
      </div>

      {/* Authority Boundary Banner */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800">
          <p className="font-medium">Legal validity is established at off-chain finalization.</p>
          <p className="mt-1">
            Protocol publication is downstream and supplementary. A publication failure
            does <strong>not</strong> affect the legal validity of the notarization.
            The off-chain finalization record is the authoritative legal act.
          </p>
        </div>
      </div>

      {/* Legal Finalization Status */}
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Legal Finalization</h3>
        <LegalStatusCard
          state={caseState}
          finalizedAt={caseData.timestamps.finalizedAt}
          authorityProvider={caseData.activeAuthorityProvider}
        />
        {caseData.timestamps.finalizedAt && (
          <div className="mt-3 bg-white rounded-xl border border-neutral-200 p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-neutral-500 text-xs mb-1">Finalized At</p>
                <p className="font-medium text-neutral-800">{formatDateTime(caseData.timestamps.finalizedAt)}</p>
              </div>
              <div>
                <p className="text-neutral-500 text-xs mb-1">Authority</p>
                <p className="font-medium text-neutral-800 capitalize">
                  {caseData.activeAuthorityProvider.replace(/_/g, ' ')}
                </p>
              </div>
              {execution?.authorizationTime && (
                <div>
                  <p className="text-neutral-500 text-xs mb-1">Authority Execution</p>
                  <p className="font-medium text-neutral-800">{formatDateTime(execution.authorizationTime)}</p>
                </div>
              )}
              <div>
                <p className="text-neutral-500 text-xs mb-1">Execution Status</p>
                <p className="font-medium text-neutral-800 capitalize">{execution?.status ?? 'not recorded'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Publication Status */}
      <div>
        <h3 className="font-semibold text-neutral-900 mb-3">Protocol Publication</h3>

        {!caseData.timestamps.finalizedAt ? (
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6 text-center text-neutral-500 text-sm">
            Case not yet finalized. Publication is only available after legal finalization.
          </div>
        ) : (
          <div className="space-y-4">
            <ProtocolPublicationLabel
              state={
                pubStatus === 'published' ? 'PUBLISHED' :
                pubStatus === 'failed' ? 'PUBLICATION_FAILED' :
                'PUBLICATION_PENDING'
              }
              context="banner"
            />

            <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-neutral-500 text-xs mb-1">Publication Mode</p>
                  <p className="font-medium text-neutral-800">Protocol Publication Enabled</p>
                </div>
                <div>
                  <p className="text-neutral-500 text-xs mb-1">Current State</p>
                  <div className="flex items-center gap-2">
                    {pubStatus === 'published' && <CheckCircle2 className="w-4 h-4 text-success-600" />}
                    {pubStatus === 'failed' && <AlertCircle className="w-4 h-4 text-danger-500" />}
                    <span className="font-medium text-neutral-800 capitalize">{pubStatus ?? 'pending'}</span>
                  </div>
                </div>
                {execution?.publicationTxHash && (
                  <div className="col-span-2">
                    <p className="text-neutral-500 text-xs mb-1">Transaction Hash</p>
                    <code className="text-xs font-mono text-neutral-700 break-all">{execution.publicationTxHash}</code>
                  </div>
                )}
                {execution?.publicationTime && (
                  <div>
                    <p className="text-neutral-500 text-xs mb-1">Published At</p>
                    <p className="font-medium text-neutral-800">{formatDateTime(execution.publicationTime)}</p>
                  </div>
                )}
              </div>

              {/* Publication attempt log */}
              <div className="pt-3 border-t border-neutral-100">
                <p className="text-xs font-medium text-neutral-600 mb-2">Publication Attempt Log</p>
                <div className="text-xs text-neutral-600 space-y-1 font-mono bg-neutral-50 rounded-lg p-3">
                  <p>
                    {execution?.authorizationTime ? formatDateTime(execution.authorizationTime) : '—'}
                    {' '}— Publication attempt initiated
                  </p>
                  {pubStatus === 'published' && execution?.publicationTime && (
                    <p className="text-success-700">
                      {formatDateTime(execution.publicationTime)} — Published successfully
                    </p>
                  )}
                  {pubStatus === 'failed' && (
                    <p className="text-danger-600">— Publication failed (network error)</p>
                  )}
                </div>
              </div>

              {/* Retry for failed */}
              {pubStatus === 'failed' && (
                <div className="pt-3 border-t border-neutral-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-danger-800">Publication Failed</p>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        The notarization is legally valid. Retry when the protocol network is available.
                      </p>
                    </div>
                    <button
                      disabled
                      title="Retry not yet integrated"
                      className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-200 text-neutral-400 rounded-lg text-sm font-medium cursor-not-allowed"
                    >
                      <RefreshCw className="w-4 h-4" />
                      Retry (not yet integrated)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
