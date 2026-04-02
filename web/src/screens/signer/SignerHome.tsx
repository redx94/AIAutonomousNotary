import React from 'react';
import { useCaseStore } from '../../store/useCaseStore';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StepTracker } from '../../components/ui/StepTracker';
import { CaseService } from '../../services/caseService';
import { cn } from '../../lib/utils';
import { FileText, Clock, ChevronRight, Plus } from 'lucide-react';

export const SignerHome: React.FC = () => {
  const { cases, fetchCases } = useCaseStore();
  
  React.useEffect(() => {
    fetchCases();
  }, [fetchCases]);
  
  // Get the most active case for the signer
  const activeCase = cases[2]; // Using the review pending case as the active one
  
  const steps = activeCase ? [
    { id: 'intake', label: 'Document', description: 'Upload complete', status: 'completed' as const },
    { id: 'identity', label: 'Identity', description: 'Verified', status: 'completed' as const },
    { id: 'ai', label: 'AI Review', description: 'Analyzed', status: 'completed' as const },
    { id: 'human', label: 'Authority Review', description: 'In progress', status: activeCase.humanReviewStatus.state === 'completed' ? 'completed' as const : 'in_progress' as const },
    { id: 'ceremony', label: 'Session', description: 'Pending', status: 'pending' as const },
    { id: 'finalize', label: 'Finalized', description: 'Pending', status: 'pending' as const },
  ] : [];
  
  const nextAction = activeCase ? CaseService.getNextAction(activeCase) : null;
  
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Welcome back, Sarah</h2>
        <p className="text-neutral-600 mt-1">
          Manage your notarizations and track your case progress.
        </p>
      </div>
      
      {/* Active Case Card */}
      {activeCase && (
        <div className="bg-white rounded-xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-neutral-100">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-neutral-900">
                    Service Agreement 2024
                  </h3>
                  <StatusBadge state={activeCase.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' : activeCase.humanReviewStatus.state === 'completed' ? 'REVIEW_COMPLETE' : 'DRAFT'} />
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
              currentStepId="human"
              orientation="horizontal"
            />
          </div>
          
          {/* Next Action */}
          <div className="p-6 border-t border-neutral-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-neutral-900">Next Step</p>
                <p className="text-sm text-neutral-600 mt-0.5">
                  A commissioned notary is reviewing your case
                </p>
              </div>
              <a
                href={nextAction?.path || '/signer/case'}
                className={cn(
                  'inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                  nextAction?.enabled
                    ? 'bg-primary-600 text-white hover:bg-primary-700'
                    : 'bg-neutral-100 text-neutral-400 cursor-not-allowed'
                )}
              >
                View Case
                <ChevronRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      )}
      
      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <a
          href="/signer/upload"
          className="flex items-center gap-4 p-6 bg-white rounded-xl border border-neutral-200 hover:border-primary-300 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center group-hover:bg-primary-100 transition-colors">
            <Plus className="w-6 h-6 text-primary-600" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">New Notarization</h4>
            <p className="text-sm text-neutral-600">Start a new document notarization</p>
          </div>
        </a>
        
        <div className="flex items-center gap-4 p-6 bg-white rounded-xl border border-neutral-200">
          <div className="w-12 h-12 rounded-lg bg-neutral-100 flex items-center justify-center">
            <FileText className="w-6 h-6 text-neutral-500" />
          </div>
          <div>
            <h4 className="font-semibold text-neutral-900">Past Documents</h4>
            <p className="text-sm text-neutral-600">View {cases.filter(c => c.timestamps.finalizedAt).length} completed notarizations</p>
          </div>
        </div>
      </div>
      
      {/* Recent Cases */}
      <div>
        <h3 className="text-lg font-semibold text-neutral-900 mb-4">Recent Cases</h3>
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="divide-y divide-neutral-100">
            {cases.slice(0, 5).map((c) => (
              <a
                key={c.actId}
                href={`/signer/case?id=${c.actId}`}
                className="flex items-center justify-between p-4 hover:bg-neutral-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-neutral-500" />
                  </div>
                  <div>
                    <p className="font-medium text-neutral-900">
                      {c.documentType.charAt(0).toUpperCase() + c.documentType.slice(1)} Notarization
                    </p>
                    <div className="flex items-center gap-2 text-sm text-neutral-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(c.timestamps.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
                <StatusBadge 
                  state={c.humanReviewStatus.state === 'refused' ? 'REFUSED' : 
                         c.timestamps.finalizedAt ? 'FINALIZED_OFFCHAIN' :
                         c.humanReviewStatus.state === 'completed' ? 'REVIEW_COMPLETE' :
                         c.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' :
                         c.identityProofingStatus.state !== 'completed' ? 'IDENTITY_PENDING' :
                         'AI_ANALYZED'} 
                  size="sm"
                />
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
