import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import { RiskBandCard } from '../../components/evidence/RiskBandCard';
import { EventTimeline } from '../../components/evidence/EventTimeline';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { Case, AIAnalysisResult, CaseEvent, PolicyDecision } from '../../types';
import {
  FileText, User, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, MessageSquare,
} from 'lucide-react';

export const NotaryCaseReview: React.FC = () => {
  const { caseId } = useParams<{ caseId: string }>();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = React.useState<'document' | 'identity' | 'ai' | 'history'>('document');
  const [decision, setDecision] = React.useState<'approve' | 'refuse' | null>(null);
  const [notes, setNotes] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitResult, setSubmitResult] = React.useState<{ success: boolean; reviewId?: string; error?: string } | null>(null);

  const [caseData, setCaseData] = React.useState<Case | null>(null);
  const [aiAnalysis, setAiAnalysis] = React.useState<AIAnalysisResult | null>(null);
  const [events, setEvents] = React.useState<CaseEvent[]>([]);
  const [policy, setPolicy] = React.useState<PolicyDecision | null>(null);
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
      if (c?.aiAnalysisStatus.analysisId) {
        const ai = await caseAdapter.getAIAnalysis(c.aiAnalysisStatus.analysisId);
        setAiAnalysis(ai || null);
      }
      if (c?.policyDecisionId) {
        const pol = await caseAdapter.getPolicyDecision(c.policyDecisionId);
        setPolicy(pol || null);
      }
    }).finally(() => setLoading(false));
  }, [caseId]);

  const handleSubmitDecision = async () => {
    if (!decision || !notes.trim() || !caseId) return;
    setSubmitting(true);
    const result = await caseAdapter.submitReviewDecision(caseId, decision, notes);
    setSubmitResult(result);
    setSubmitting(false);
  };

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
        <h3 className="text-lg font-semibold text-neutral-700">No case selected</h3>
        <p className="text-neutral-500 mt-2">Select a case from the notary queue.</p>
        <button
          onClick={() => navigate('/notary')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
        >
          Go to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/notary')}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Queue
          </button>
          <div className="h-4 w-px bg-neutral-300" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-neutral-900">Case Review</h2>
              <StatusBadge
                state={caseData.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' : 'REVIEW_COMPLETE'}
                size="sm"
              />
            </div>
            <code className="text-xs font-mono text-neutral-500">{caseData.actId}</code>
          </div>
        </div>
        <HumanAuthorityLabel context="inline" />
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-0">
        {/* Left Column - Document & Evidence */}
        <div className="lg:col-span-2 flex flex-col gap-4 min-h-0">
          {/* Tabs */}
          <div className="bg-white rounded-lg border border-neutral-200 p-1 flex gap-1">
            {[
              { id: 'document', label: 'Document', icon: FileText },
              { id: 'identity', label: 'Identity', icon: User },
              { id: 'ai', label: 'AI Analysis', icon: AlertCircle },
              { id: 'history', label: 'History', icon: MessageSquare },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-1 justify-center',
                    activeTab === tab.id
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-neutral-600 hover:bg-neutral-50'
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          <div className="flex-1 bg-white rounded-xl border border-neutral-200 overflow-hidden">
            {activeTab === 'document' && (
              <div className="h-full flex flex-col">
                <div className="flex items-center gap-3 px-5 py-3 border-b border-neutral-100 bg-neutral-50">
                  <FileText className="w-4 h-4 text-neutral-500" />
                  <span className="text-sm font-medium text-neutral-700 capitalize">
                    {caseData.documentType.replace(/_/g, ' ')} — {caseData.actType}
                  </span>
                  <span className="ml-auto text-xs font-mono text-neutral-400">{caseData.documentHash}</span>
                </div>
                <div className="flex-1 flex items-center justify-center bg-neutral-50">
                  <div className="text-center">
                    <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                    <p className="text-neutral-500 text-sm">
                      Document artifact preview — hash verified
                    </p>
                    <p className="text-xs text-neutral-400 mt-1 font-mono">{caseData.documentHash}</p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'identity' && (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center border border-neutral-200">
                    <span className="text-xs text-neutral-500">ID Front</span>
                  </div>
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center border border-neutral-200">
                    <span className="text-xs text-neutral-500">ID Back</span>
                  </div>
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center border border-neutral-200">
                    <span className="text-xs text-neutral-500">Selfie</span>
                  </div>
                </div>
                <div className="space-y-2">
                  {[
                    { label: 'Name', value: caseData.signer.fullName },
                    { label: 'Email', value: caseData.signer.email },
                    { label: 'Verification Status', value: caseData.identityProofingStatus.state === 'completed' ? 'Verified' : 'Pending' },
                    { label: 'Completed Checks', value: caseData.identityProofingStatus.completedChecks.join(', ') || 'None' },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-2 border-b border-neutral-100">
                      <span className="text-sm text-neutral-500">{row.label}</span>
                      <span className={cn('text-sm font-medium', row.label === 'Verification Status' && row.value === 'Verified' ? 'text-success-700' : 'text-neutral-900')}>
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'ai' && (
              <div className="p-6 space-y-4">
                <AIAdvisoryLabel context="banner" />
                {aiAnalysis ? (
                  <>
                    <RiskBandCard riskScore={aiAnalysis.riskScore} fraudSignals={aiAnalysis.fraudSignals} />
                    {aiAnalysis.documentFindings.length > 0 && (
                      <div className="p-4 bg-neutral-50 rounded-lg border border-neutral-200">
                        <h4 className="font-medium text-neutral-900 mb-2 text-sm">Document Findings</h4>
                        <ul className="space-y-2">
                          {aiAnalysis.documentFindings.map((finding, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm">
                              <AlertCircle className={cn(
                                'w-4 h-4 flex-shrink-0 mt-0.5',
                                finding.severity === 'high' ? 'text-danger-500' :
                                finding.severity === 'medium' ? 'text-warning-500' : 'text-neutral-400'
                              )} />
                              <span className="text-neutral-700">{finding.finding}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-neutral-500">
                    {caseData.aiAnalysisStatus.state === 'pending'
                      ? 'AI analysis has not yet completed.'
                      : 'AI analysis details not available for this case.'}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <div className="p-4 overflow-y-auto max-h-96">
                {events.length > 0
                  ? <EventTimeline events={events} />
                  : <p className="text-sm text-neutral-500">No events recorded yet.</p>
                }
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Authority Controls */}
        <div className="space-y-4 overflow-y-auto">
          {/* Case Summary */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900 mb-3">Case Summary</h3>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Signer', value: caseData.signer.fullName },
                { label: 'Document', value: caseData.documentType.replace(/_/g, ' ') },
                { label: 'Act Type', value: caseData.actType },
                { label: 'Jurisdiction', value: caseData.jurisdiction },
                { label: 'Authority Mode', value: caseData.activeAuthorityProvider === 'human_commissioned' ? 'Human Commissioned' : 'Autonomous' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between">
                  <span className="text-neutral-500">{row.label}</span>
                  <span className="font-medium text-neutral-900 capitalize">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Decision Panel */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <div className="mb-3">
              <HumanAuthorityLabel size="sm" />
              <p className="text-xs text-neutral-500 mt-1">
                As the commissioned notary, your decision is the legal authority act.
              </p>
            </div>

            {submitResult ? (
              <div className={cn(
                'rounded-lg p-4 text-sm',
                submitResult.success ? 'bg-success-50 border border-success-200 text-success-800' : 'bg-danger-50 border border-danger-200 text-danger-800'
              )}>
                {submitResult.success ? (
                  <>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      <CheckCircle2 className="w-4 h-4" />
                      Decision recorded
                    </div>
                    <p className="text-xs opacity-75">Review ID: {submitResult.reviewId}</p>
                    <button
                      onClick={() => navigate('/notary')}
                      className="mt-3 px-3 py-1.5 bg-success-600 text-white rounded-md text-xs font-medium hover:bg-success-700 transition-colors"
                    >
                      Return to Queue
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 font-medium mb-1">
                      <XCircle className="w-4 h-4" />
                      Submission failed
                    </div>
                    <p className="text-xs">{submitResult.error}</p>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-2">
                  <button
                    onClick={() => setDecision('approve')}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                      decision === 'approve'
                        ? 'border-success-500 bg-success-50'
                        : 'border-neutral-200 hover:border-success-300'
                    )}
                  >
                    <CheckCircle2 className={cn('w-5 h-5', decision === 'approve' ? 'text-success-600' : 'text-neutral-400')} />
                    <div>
                      <p className="font-medium text-neutral-900">Approve</p>
                      <p className="text-xs text-neutral-500">Proceed to ceremony</p>
                    </div>
                  </button>

                  <button
                    onClick={() => setDecision('refuse')}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-colors text-left',
                      decision === 'refuse'
                        ? 'border-danger-500 bg-danger-50'
                        : 'border-neutral-200 hover:border-danger-300'
                    )}
                  >
                    <XCircle className={cn('w-5 h-5', decision === 'refuse' ? 'text-danger-600' : 'text-neutral-400')} />
                    <div>
                      <p className="font-medium text-neutral-900">Refuse</p>
                      <p className="text-xs text-neutral-500">Reject this notarization</p>
                    </div>
                  </button>
                </div>

                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Notes <span className="text-danger-500">*</span>
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Document your reasoning for the record..."
                    className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    rows={3}
                  />
                </div>

                <button
                  onClick={handleSubmitDecision}
                  disabled={!decision || !notes.trim() || submitting}
                  className={cn(
                    'w-full py-2.5 rounded-lg font-medium transition-colors inline-flex items-center justify-center gap-2',
                    decision && notes.trim() && !submitting
                      ? decision === 'approve'
                        ? 'bg-success-600 text-white hover:bg-success-700'
                        : 'bg-danger-600 text-white hover:bg-danger-700'
                      : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                  )}
                >
                  {submitting && (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  )}
                  {submitting ? 'Submitting…' : 'Submit Decision'}
                </button>
              </div>
            )}
          </div>

          {/* Policy Requirements */}
          <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
            <h4 className="font-medium text-primary-900 mb-2 text-sm">Policy Requirements</h4>
            {policy ? (
              <ul className="space-y-1.5 text-sm text-primary-800">
                {policy.requiredFlowSteps.slice(0, 5).map((step) => (
                  <li key={step} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-600 flex-shrink-0" />
                    <span className="capitalize">{step.replace(/_/g, ' ')}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-1.5 text-sm text-primary-800">
                {['Identity verification required', 'Human ceremony required', 'Final signoff required', 'Evidence bundle required'].map((req) => (
                  <li key={req} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success-600 flex-shrink-0" />
                    {req}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
