import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case, AIAnalysisResult, PolicyDecision, HumanReview, CeremonyRecord, CaseEvent } from '../../types';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import { EventTimeline } from '../../components/evidence/EventTimeline';
import { formatDateTime } from '../../lib/utils';
import { ChevronLeft, AlertCircle, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import type { CaseState } from '../../types';

function deriveState(c: Case): CaseState {
  if (c.humanReviewStatus.state === 'refused') return 'REFUSED';
  if (c.timestamps.finalizedAt) return 'FINALIZED_OFFCHAIN';
  if (c.ceremonyStatus.state === 'completed') return 'CEREMONY_COMPLETE';
  if (c.humanReviewStatus.state === 'completed') return 'REVIEW_COMPLETE';
  if (c.humanReviewStatus.state === 'in_progress') return 'REVIEW_PENDING';
  if (c.identityProofingStatus.state === 'completed') return 'IDENTITY_COMPLETE';
  if (c.aiAnalysisStatus.state === 'completed') return 'AI_ANALYZED';
  return 'DRAFT';
}

export const ComplianceCaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [aiAnalysis, setAiAnalysis] = React.useState<AIAnalysisResult | null>(null);
  const [policy, setPolicy] = React.useState<PolicyDecision | null>(null);
  const [review, setReview] = React.useState<HumanReview | null>(null);
  const [ceremony, setCeremony] = React.useState<CeremonyRecord | null>(null);
  const [events, setEvents] = React.useState<CaseEvent[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!caseId) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      caseAdapter.getCase(caseId),
      caseAdapter.getCaseEvents(caseId),
    ]).then(async ([c, evts]) => {
      setCaseData(c || null);
      setEvents(evts);
      if (!c) return;
      const [ai, pol, rev, cer] = await Promise.all([
        c.aiAnalysisStatus.analysisId ? caseAdapter.getAIAnalysis(c.aiAnalysisStatus.analysisId) : Promise.resolve(undefined),
        c.policyDecisionId ? caseAdapter.getPolicyDecision(c.policyDecisionId) : Promise.resolve(undefined),
        c.humanReviewStatus.reviewId ? caseAdapter.getHumanReview(c.humanReviewStatus.reviewId) : Promise.resolve(undefined),
        c.ceremonyStatus.ceremonyId ? caseAdapter.getCeremonyRecord(c.ceremonyStatus.ceremonyId) : Promise.resolve(undefined),
      ]);
      setAiAnalysis(ai || null);
      setPolicy(pol || null);
      setReview(rev || null);
      setCeremony(cer || null);
    }).finally(() => setLoading(false));
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <button onClick={() => navigate('/compliance')} className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 text-sm mb-2">
            <ChevronLeft className="w-4 h-4" />
            Back to Ledger
          </button>
          <h2 className="text-2xl font-semibold text-neutral-900">Compliance Audit — Case Detail</h2>
          <code className="text-sm font-mono text-neutral-500">{caseData.actId}</code>
        </div>
        <StatusBadge state={caseState} size="lg" />
      </div>

      {/* Legal Status */}
      <LegalStatusCard
        state={caseState}
        finalizedAt={caseData.timestamps.finalizedAt}
        authorityProvider={caseData.activeAuthorityProvider}
      />

      {/* Three-column grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Case Meta */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900">Case Information</h3>
          <div className="space-y-2 text-sm">
            {[
              { label: 'Signer', value: caseData.signer.fullName },
              { label: 'Email', value: caseData.signer.email },
              { label: 'Document Type', value: caseData.documentType.replace(/_/g, ' ') },
              { label: 'Act Type', value: caseData.actType },
              { label: 'Jurisdiction', value: caseData.jurisdiction },
              { label: 'Authority Mode', value: caseData.activeAuthorityProvider === 'human_commissioned' ? 'Human Commissioned' : 'Autonomous' },
              { label: 'Legal Mode', value: caseData.legalMode },
              { label: 'Created', value: formatDateTime(caseData.timestamps.createdAt) },
              ...(caseData.timestamps.finalizedAt ? [{ label: 'Finalized', value: formatDateTime(caseData.timestamps.finalizedAt) }] : []),
            ].map((row) => (
              <div key={row.label} className="flex justify-between gap-4">
                <span className="text-neutral-500 flex-shrink-0">{row.label}</span>
                <span className="font-medium text-neutral-700 capitalize text-right">{row.value}</span>
              </div>
            ))}
          </div>
          <div className="pt-3 border-t border-neutral-100 space-y-2">
            <HumanAuthorityLabel context="inline" size="sm" />
          </div>
        </div>

        {/* Policy Decision */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900">Policy Decision</h3>
          {policy ? (
            <div className="space-y-3">
              <div className={`flex items-center gap-2 p-3 rounded-lg ${policy.allowed ? 'bg-success-50 text-success-700' : 'bg-danger-50 text-danger-700'}`}>
                {policy.allowed
                  ? <CheckCircle2 className="w-5 h-5" />
                  : <XCircle className="w-5 h-5" />
                }
                <span className="font-medium">{policy.allowed ? 'Allowed' : 'Blocked'}</span>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Required Mode</span>
                  <span className="font-medium text-neutral-700 capitalize">{policy.requiredAuthorityMode.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Human Supervision</span>
                  <span className="font-medium text-neutral-700">{policy.requireHumanSupervision ? 'Required' : 'Not required'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Human Ceremony</span>
                  <span className="font-medium text-neutral-700">{policy.requireHumanCeremony ? 'Required' : 'Not required'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Max Risk Score</span>
                  <span className="font-medium text-neutral-700">{policy.maxRiskScore}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Policy Version</span>
                  <span className="font-mono text-xs text-neutral-600">{policy.policyVersion}</span>
                </div>
              </div>
              {policy.warnings.length > 0 && (
                <div className="pt-2 border-t border-neutral-100">
                  <p className="text-xs font-medium text-neutral-600 mb-1">Policy Warnings</p>
                  {policy.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-warning-700 bg-warning-50 px-2 py-1 rounded mb-1">{w}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No policy decision recorded for this case.</p>
          )}
        </div>

        {/* Authority Execution */}
        <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
          <h3 className="font-semibold text-neutral-900">Authority Execution</h3>

          {/* AI Analysis */}
          <div className="border border-neutral-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">AI Analysis</span>
              <AIAdvisoryLabel size="sm" />
            </div>
            <div className="text-sm text-neutral-600">
              State: <span className="font-medium text-neutral-900 capitalize">{caseData.aiAnalysisStatus.state}</span>
              {aiAnalysis && (
                <span className="ml-2 text-xs">Risk: {aiAnalysis.riskScore}/100</span>
              )}
            </div>
          </div>

          {/* Human Review */}
          <div className="border border-neutral-100 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-neutral-700">Human Review</span>
              <HumanAuthorityLabel size="sm" />
            </div>
            {review ? (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Reviewer</span>
                  <span className="font-medium text-neutral-800">{review.reviewerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Decision</span>
                  <span className={`font-medium capitalize ${review.decision === 'approve' ? 'text-success-700' : 'text-danger-700'}`}>
                    {review.decision}
                  </span>
                </div>
                {review.notes && (
                  <p className="text-xs text-neutral-600 mt-1 italic">"{review.notes}"</p>
                )}
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                State: <span className="font-medium capitalize">{caseData.humanReviewStatus.state}</span>
              </p>
            )}
          </div>

          {/* Ceremony */}
          <div className="border border-neutral-100 rounded-lg p-3">
            <span className="text-sm font-medium text-neutral-700 block mb-2">Ceremony</span>
            {ceremony ? (
              <div className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Confirmed</span>
                  <span className="font-medium text-neutral-800">{formatDateTime(ceremony.confirmedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Ceremony ID</span>
                  <code className="text-xs font-mono text-neutral-600">{ceremony.ceremonyId}</code>
                </div>
              </div>
            ) : (
              <p className="text-xs text-neutral-500">
                State: <span className="font-medium capitalize">{caseData.ceremonyStatus.state}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Quick Links */}
      <div className="flex flex-wrap gap-3">
        {caseData.evidenceBundleId && (
          <button
            onClick={() => navigate(`/compliance/evidence/${caseData.evidenceBundleId}`)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            View Evidence Bundle
          </button>
        )}
        <button
          onClick={() => navigate(`/compliance/publication/${caseData.actId}`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
          Publication Status
        </button>
      </div>

      {/* Event Timeline */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Event Timeline</h3>
        {events.length > 0
          ? <EventTimeline events={events} />
          : <p className="text-sm text-neutral-500">No events recorded for this case.</p>
        }
      </div>
    </div>
  );
};
