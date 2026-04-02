import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCaseStore } from '../../store/useCaseStore';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StepTracker } from '../../components/ui/StepTracker';
import { cn } from '../../lib/utils';
import type { Case, CaseState } from '../../types';
import { FileText, Clock, ChevronRight, Plus } from 'lucide-react';

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
  return [
    {
      id: 'intake', label: 'Document',
      description: c.documentId ? 'Uploaded' : 'Pending',
      status: (c.documentId ? 'completed' : 'pending') as 'completed' | 'pending' | 'in_progress',
    },
    {
      id: 'identity', label: 'Identity',
      description: c.identityProofingStatus.state === 'completed' ? 'Verified' : 'Pending',
      status: (c.identityProofingStatus.state === 'completed' ? 'completed' :
               c.identityProofingStatus.state === 'in_progress' ? 'in_progress' : 'pending') as 'completed' | 'pending' | 'in_progress',
    },
    {
      id: 'ai', label: 'AI Review',
      description: c.aiAnalysisStatus.state === 'completed' ? 'Analyzed' : 'Pending',
      status: (c.aiAnalysisStatus.state === 'completed' ? 'completed' :
               c.aiAnalysisStatus.state === 'pending' ? 'pending' : 'in_progress') as 'completed' | 'pending' | 'in_progress',
    },
    {
      id: 'human', label: 'Authority Review',
      description: c.humanReviewStatus.state === 'completed' ? 'Approved' :
                   c.humanReviewStatus.state === 'refused' ? 'Refused' :
                   c.humanReviewStatus.state === 'in_progress' ? 'In progress' : 'Pending',
      status: (c.humanReviewStatus.state === 'completed' || c.humanReviewStatus.state === 'refused'
               ? 'completed' :
               c.humanReviewStatus.state === 'in_progress' ? 'in_progress' : 'pending') as 'completed' | 'pending' | 'in_progress',
    },
    {
      id: 'ceremony', label: 'Session',
      description: c.ceremonyStatus.state === 'completed' ? 'Complete' : 'Pending',
      status: (c.ceremonyStatus.state === 'completed' ? 'completed' :
               c.ceremonyStatus.state === 'in_progress' ? 'in_progress' : 'pending') as 'completed' | 'pending' | 'in_progress',
    },
    {
      id: 'finalize', label: 'Finalized',
      description: c.timestamps.finalizedAt ? 'Done' : 'Pending',
      status: (c.timestamps.finalizedAt ? 'completed' : 'pending') as 'completed' | 'pending' | 'in_progress',
    },
  ];
}

function getNextAction(c: Case): { label: string; path: string; enabled: boolean } {
  const state = deriveState(c);
  const map: Partial<Record<CaseState, { label: string; path: string; enabled: boolean }>> = {
    DRAFT: { label: 'Upload Document', path: '/signer/upload', enabled: true },
    INTAKE_COMPLETE: { label: 'Complete Identity Check', path: '/signer/identity', enabled: true },
    IDENTITY_PENDING: { label: 'Complete Identity Check', path: '/signer/identity', enabled: true },
    REVIEW_PENDING: { label: 'View Case Status', path: '/signer/case', enabled: true },
    CEREMONY_PENDING: { label: 'Join Session', path: '/signer/session', enabled: true },
    FINALIZED_OFFCHAIN: { label: 'View Certificate', path: '/signer/final', enabled: true },
    REFUSED: { label: 'View Details', path: '/signer/case', enabled: true },
  };
  return map[state] ?? { label: 'View Case', path: `/signer/case/${c.actId}`, enabled: true };
}

export const SignerHome: React.FC = () => {
  const { cases, fetchCases } = useCaseStore();
  const navigate = useNavigate();

  React.useEffect(() => {
    fetchCases();
  }, [fetchCases]);

  // Derive active case: first non-refused, non-finalized case; or most recent overall
  const activeCase =
    cases.find(c => c.humanReviewStatus.state !== 'refused' && !c.timestamps.finalizedAt) ??
    cases[0] ??
    null;

  const steps = activeCase ? buildSteps(activeCase) : [];
  const currentStepId =
    steps.find(s => s.status === 'in_progress')?.id ??
    steps.filter(s => s.status === 'completed').slice(-1)[0]?.id ??
    'intake';
  const nextAction = activeCase ? getNextAction(activeCase) : null;
  const caseState = activeCase ? deriveState(activeCase) : null;

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">
          {activeCase ? `Welcome back, ${activeCase.signer.fullName.split(' ')[0]}` : 'Welcome'}
        </h2>
        <p className="text-neutral-600 mt-1">
          Manage your notarizations and track your case progress.
        </p>
      </div>

      {/* Active Case Card */}
      {activeCase && caseState && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-neutral-900 capitalize">
                    {activeCase.documentType.replace(/_/g, ' ')} {activeCase.actType}
                  </h3>
                  <StatusBadge state={caseState} />
                </div>
                <p className="text-sm text-neutral-500 mt-1">
                  {activeCase.actType.charAt(0).toUpperCase() + activeCase.actType.slice(1)} • {activeCase.jurisdiction}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-neutral-500">Case ID</p>
                <code className="text-xs font-mono text-neutral-700">{activeCase.actId}</code>
              </div>
            </div>
          </div>

          {/* Step Tracker */}
          <div className="p-6 bg-neutral-50/50">
            <StepTracker
              steps={steps}
              currentStepId={currentStepId}
              orientation="horizontal"
            />
          </div>

          {/* Next Action */}
          <div className="p-6 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">Next Step</p>
                <p className="text-sm text-neutral-600 mt-0.5">
                  {caseState === 'REVIEW_PENDING'
                    ? 'A commissioned notary is reviewing your case'
                    : caseState === 'REFUSED'
                    ? 'This notarization has been refused'
                    : caseState === 'FINALIZED_OFFCHAIN'
                    ? 'Your notarization is legally complete'
                    : 'Continue to the next step'}
                </p>
              </div>
              <button
                onClick={() => navigate(nextAction?.path || `/signer/case/${activeCase.actId}`)}
                disabled={!nextAction?.enabled}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  nextAction?.enabled
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                )}
              >
                {nextAction?.label ?? 'View Case'}
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!activeCase && cases.length === 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 p-12 text-center">
          <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-700">No active cases</h3>
          <p className="text-neutral-500 mt-2 mb-6">Start a new notarization to get going.</p>
          <button
            onClick={() => navigate('/signer/upload')}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Notarization
          </button>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => navigate('/signer/upload')}
          className="flex items-center gap-4 p-6 bg-white rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all group text-left"
        >
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
            <Plus className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">New Notarization</h4>
            <p className="text-sm text-neutral-600">Start a new document notarization</p>
          </div>
        </button>

        <div className="flex items-center gap-4 p-6 bg-white rounded-xl border border-neutral-200">
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-neutral-500" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">Past Documents</h4>
            <p className="text-sm text-neutral-600">
              {cases.filter(c => c.timestamps.finalizedAt).length} completed notarizations
            </p>
          </div>
        </div>
      </div>

      {/* Recent Cases */}
      {cases.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent Cases</h3>
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
            <div className="divide-y divide-neutral-100">
              {cases.slice(0, 5).map((c) => (
                <button
                  key={c.actId}
                  onClick={() => navigate(`/signer/case/${c.actId}`)}
                  className="w-full flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                      <FileText className="w-5 h-5 text-neutral-500" />
                    </div>
                    <div>
                      <p className="font-medium text-neutral-900 capitalize">
                        {c.documentType.replace(/_/g, ' ')} Notarization
                      </p>
                      <div className="flex items-center gap-2 text-sm text-neutral-500">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{new Date(c.timestamps.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  <StatusBadge state={deriveState(c)} size="sm" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
