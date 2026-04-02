import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCaseStore } from '../../store/useCaseStore';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StepTracker } from '../../components/ui/StepTracker';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { EventTimeline } from '../../components/evidence/EventTimeline';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case, AIAnalysisResult, CaseEvent, CaseState } from '../../types';
import { cn } from '../../lib/utils';
import { FileText, User, Clock, ChevronRight, AlertCircle } from 'lucide-react';

function deriveState(c: Case): CaseState {
  if (c.humanReviewStatus.state === 'refused') return 'REFUSED';
  if (c.timestamps.finalizedAt) return 'FINALIZED_OFFCHAIN';
  if (c.ceremonyStatus.state === 'completed') return 'CEREMONY_COMPLETE';
  if (c.humanReviewStatus.state === 'completed') return 'REVIEW_COMPLETE';
  if (c.humanReviewStatus.state === 'in_progress') return 'REVIEW_PENDING';
  if (c.identityProofingStatus.state === 'completed') return 'IDENTITY_COMPLETE';
  if (c.identityProofingStatus.state !== 'pending') return 'IDENTITY_PENDING';
  if (c.aiAnalysisStatus.state === 'completed') return 'AI_ANALYZED';
  if (c.documentId) return 'INTAKE_COMPLETE';
  return 'DRAFT';
}

function buildSteps(c: Case) {
  type StepStatus = 'completed' | 'pending' | 'in_progress';
  return [
    {
      id: 'intake', label: 'Document',
      description: c.documentId ? 'Uploaded' : 'Pending',
      status: (c.documentId ? 'completed' : 'pending') as StepStatus,
    },
    {
      id: 'identity', label: 'Identity',
      description: c.identityProofingStatus.state === 'completed' ? 'Verified' : 'Pending',
      status: (c.identityProofingStatus.state === 'completed' ? 'completed' :
               c.identityProofingStatus.state === 'in_progress' ? 'in_progress' : 'pending') as StepStatus,
    },
    {
      id: 'ai', label: 'AI Analysis',
      description: c.aiAnalysisStatus.state === 'completed' ? 'Analyzed' : 'Pending',
      status: (c.aiAnalysisStatus.state === 'completed' ? 'completed' :
               c.aiAnalysisStatus.state === 'pending' ? 'pending' : 'in_progress') as StepStatus,
    },
    {
      id: 'human', label: 'Authority Review',
      description: c.humanReviewStatus.state === 'completed' ? 'Approved' :
                   c.humanReviewStatus.state === 'refused' ? 'Refused' :
                   c.humanReviewStatus.state === 'in_progress' ? 'In progress' : 'Pending',
      status: (c.humanReviewStatus.state === 'completed' || c.humanReviewStatus.state === 'refused'
               ? 'completed' :
               c.humanReviewStatus.state === 'in_progress' ? 'in_progress' : 'pending') as StepStatus,
    },
    {
      id: 'ceremony', label: 'Session',
      description: c.ceremonyStatus.state === 'completed' ? 'Complete' : 'Pending',
      status: (c.ceremonyStatus.state === 'completed' ? 'completed' :
               c.ceremonyStatus.state === 'in_progress' ? 'in_progress' : 'pending') as StepStatus,
    },
    {
      id: 'finalize', label: 'Finalized',
      description: c.timestamps.finalizedAt ? 'Done' : 'Pending',
      status: (c.timestamps.finalizedAt ? 'completed' : 'pending') as StepStatus,
    },
  ];
}

export const CaseDetail: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();
  const { currentCase } = useCaseStore();

  const [caseData, setCaseData] = React.useState<Case | null>(currentCase);
  const [aiAnalysis, setAiAnalysis] = React.useState<AIAnalysisResult | null>(null);
  const [events, setEvents] = React.useState<CaseEvent[]>([]);
  const [loading, setLoading] = React.useState(!currentCase);

  React.useEffect(() => {
    const id = caseId || currentCase?.actId;
    if (!id) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      caseAdapter.getCase(id),
      caseAdapter.getCaseEvents(id),
    ]).then(([c, evts]) => {
      setCaseData(c || null);
      setEvents(evts);
      if (c?.aiAnalysisStatus.analysisId) {
        caseAdapter.getAIAnalysis(c.aiAnalysisStatus.analysisId).then(a => setAiAnalysis(a || null));
      }
    }).finally(() => setLoading(false));
  }, [caseId, currentCase?.actId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!caseData) {
    return (
      <div className="max-w-6xl mx-auto text-center py-16">
        <AlertCircle className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-700">No Case Selected</h3>
        <p className="text-neutral-500 mt-2">Select a case from your dashboard to view details.</p>
        <button
          onClick={() => navigate('/signer')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    );
  }

  const caseState = deriveState(caseData);
  const steps = buildSteps(caseData);
  const currentStepId =
    steps.find(s => s.status === 'in_progress')?.id ??
    steps.filter(s => s.status === 'completed').slice(-1)[0]?.id ??
    'intake';

  return (
    <div className="max-w-6xl mx-auto">
      {/* Breadcrumb */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          <button onClick={() => navigate('/signer')} className="hover:text-neutral-700">Home</button>
          <ChevronRight className="w-4 h-4" />
          <span>My Case</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900 capitalize">
              {caseData.documentType.replace(/_/g, ' ')} {caseData.actType}
            </h2>
            <p className="text-neutral-600 mt-1">
              Case ID: <code className="text-sm font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{caseData.actId}</code>
            </p>
          </div>
          <StatusBadge state={caseState} size="lg" />
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <StepTracker steps={steps} currentStepId={currentStepId} orientation="horizontal" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Status */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Current Status</h3>
            {caseState === 'REVIEW_PENDING' && (
              <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-primary-900">Awaiting Authority Review</p>
                    <p className="text-sm text-primary-700 mt-1">
                      A commissioned notary is reviewing your case. This typically takes 15–30 minutes during business hours.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {caseState === 'REFUSED' && (
              <div className="p-4 bg-danger-50 rounded-lg border border-danger-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-danger-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-danger-900">Notarization Refused</p>
                    <p className="text-sm text-danger-700 mt-1">
                      The authority has refused this notarization. No legal validity is conferred.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {(caseState === 'FINALIZED_OFFCHAIN' || caseState === 'PUBLISHED' || caseState === 'PUBLICATION_FAILED') && (
              <div className="p-4 bg-success-50 rounded-lg border border-success-200">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-success-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-success-900">Notarization Complete</p>
                    <p className="text-sm text-success-700 mt-1">
                      Your document has been notarized under human-supervised authority.
                      Legal validity was established at off-chain finalization.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {caseData.aiAnalysisStatus.fraudSignals && caseData.aiAnalysisStatus.fraudSignals.length > 0 && (
              <div className="mt-4 p-4 bg-warning-50 rounded-lg border border-warning-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-warning-900">AI Flagged for Review</p>
                    <p className="text-sm text-warning-700 mt-1">
                      AI analysis detected signals requiring human review. The notary makes the final determination.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* AI Findings */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">AI Analysis Findings</h3>
              <AIAdvisoryLabel size="sm" />
            </div>
            {aiAnalysis ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">Risk Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          'h-full',
                          aiAnalysis.riskScore > 70 ? 'bg-danger-500' :
                          aiAnalysis.riskScore > 30 ? 'bg-warning-500' : 'bg-success-500'
                        )}
                        style={{ width: `${aiAnalysis.riskScore}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      aiAnalysis.riskScore > 70 ? 'text-danger-700' :
                      aiAnalysis.riskScore > 30 ? 'text-warning-700' : 'text-success-700'
                    )}>
                      {aiAnalysis.riskScore}/100
                    </span>
                  </div>
                </div>
                {aiAnalysis.fraudSignals.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-neutral-700">Detected Signals</p>
                    {aiAnalysis.fraudSignals.map((signal, idx) => (
                      <div key={idx} className="flex items-start gap-2 p-2 bg-warning-50 rounded border border-warning-200">
                        <AlertCircle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm text-warning-800">{signal.description}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-neutral-500">
                {caseData.aiAnalysisStatus.state === 'pending'
                  ? 'AI analysis has not yet completed.'
                  : 'AI analysis details not available for this case.'}
              </p>
            )}
          </div>

          {/* Timeline */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Case Timeline</h3>
            {events.length > 0
              ? <EventTimeline events={events.slice(0, 6)} />
              : <p className="text-sm text-neutral-500">No events recorded yet.</p>
            }
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-neutral-500" />
              Document
            </h4>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Type', value: caseData.documentType.replace(/_/g, ' ') },
                { label: 'Act Type', value: caseData.actType },
                { label: 'Jurisdiction', value: caseData.jurisdiction },
                { label: 'Created', value: new Date(caseData.timestamps.createdAt).toLocaleDateString() },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-neutral-500">{row.label}</span>
                  <span className="font-medium text-neutral-700 capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-neutral-500" />
              Signer
            </h4>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Name', value: caseData.signer.fullName },
                { label: 'Identity', value: caseData.identityProofingStatus.state === 'completed' ? 'Verified' : 'Pending' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-neutral-500">{row.label}</span>
                  <span className={cn('font-medium', row.label === 'Identity' && row.value === 'Verified' ? 'text-success-700' : 'text-neutral-700')}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4">Authority</h4>
            <div className="space-y-3">
              <HumanAuthorityLabel context="inline" size="sm" />
              <ProtocolPublicationLabel context="inline" size="sm" state={caseState} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
