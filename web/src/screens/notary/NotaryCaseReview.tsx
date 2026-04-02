import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import { RiskBandCard } from '../../components/evidence/RiskBandCard';
// import { ReviewDecisionPanel } from '../../components/ceremony/ReviewDecisionPanel';
import { EventTimeline } from '../../components/evidence/EventTimeline';
import { mockCases, mockAIAnalysis, mockEvents } from '../../data/mockCases';
import { 
  FileText, User, AlertCircle, CheckCircle2, XCircle,
  ChevronLeft, MessageSquare 
} from 'lucide-react';

export const NotaryCaseReview: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<'document' | 'identity' | 'ai' | 'history'>('document');
  const [decision, setDecision] = React.useState<'approve' | 'refuse' | null>(null);
  const [notes, setNotes] = React.useState('');
  
  // Use a mock case
  const caseData = mockCases[2]; // The high-risk case
  const aiAnalysis = mockAIAnalysis['ai-003'];
  
  const handleSubmitDecision = () => {
    if (!decision) return;
    // In a real app, this would submit to the backend
    alert(`Decision submitted: ${decision}`);
  };
  
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <a 
            href="/notary" 
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Queue
          </a>
          <div className="h-4 w-px bg-neutral-300" />
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold text-neutral-900">Case Review</h2>
              <StatusBadge state="REVIEW_PENDING" size="sm" />
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
                  onClick={() => setActiveTab(tab.id as any)}
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
              <div className="h-full flex items-center justify-center bg-neutral-50">
                <div className="text-center">
                  <FileText className="w-16 h-16 text-neutral-300 mx-auto mb-4" />
                  <p className="text-neutral-500">Document preview would render here</p>
                  <p className="text-sm text-neutral-400 mt-1">Power of Attorney - 5 pages</p>
                </div>
              </div>
            )}
            
            {activeTab === 'identity' && (
              <div className="p-6 space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-neutral-500">ID Front</span>
                  </div>
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-neutral-500">ID Back</span>
                  </div>
                  <div className="w-32 h-24 bg-neutral-100 rounded-lg flex items-center justify-center">
                    <span className="text-xs text-neutral-500">Selfie</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Name</span>
                    <span className="text-sm font-medium text-neutral-900">{caseData.signer.fullName}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Verification Status</span>
                    <span className="text-sm font-medium text-success-700">Verified</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-neutral-100">
                    <span className="text-sm text-neutral-500">Face Match</span>
                    <span className="text-sm font-medium text-neutral-900">94% confidence</span>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'ai' && (
              <div className="p-6 space-y-4">
                <AIAdvisoryLabel context="banner" />
                {aiAnalysis && (
                  <RiskBandCard 
                    riskScore={aiAnalysis.riskScore}
                    fraudSignals={aiAnalysis.fraudSignals}
                  />
                )}
                <div className="p-4 bg-warning-50 rounded-lg border border-warning-200">
                  <h4 className="font-medium text-warning-900 mb-2">AI Flagged Issues</h4>
                  <ul className="space-y-2">
                    {aiAnalysis?.documentFindings.map((finding, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <AlertCircle className="w-4 h-4 text-warning-600 flex-shrink-0 mt-0.5" />
                        <span className="text-warning-800">{finding.finding}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            
            {activeTab === 'history' && (
              <div className="p-4 overflow-y-auto max-h-96">
                <EventTimeline events={mockEvents.slice(0, 6)} />
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
              <div className="flex justify-between">
                <span className="text-neutral-500">Signer</span>
                <span className="font-medium text-neutral-900">{caseData.signer.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Document</span>
                <span className="font-medium text-neutral-900 capitalize">{caseData.documentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Act Type</span>
                <span className="font-medium text-neutral-900 capitalize">{caseData.actType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Jurisdiction</span>
                <span className="font-medium text-neutral-900">{caseData.jurisdiction}</span>
              </div>
            </div>
          </div>
          
          {/* Decision Panel */}
          <div className="bg-white rounded-xl border border-neutral-200 p-4">
            <h3 className="font-semibold text-neutral-900 mb-3 flex items-center gap-2">
              <HumanAuthorityLabel size="sm" />
            </h3>
            
            <div className="space-y-3">
              <p className="text-sm text-neutral-600">
                As the commissioned notary, you must decide whether to proceed with this notarization.
              </p>
              
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
                  <CheckCircle2 className={cn(
                    'w-5 h-5',
                    decision === 'approve' ? 'text-success-600' : 'text-neutral-400'
                  )} />
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
                  <XCircle className={cn(
                    'w-5 h-5',
                    decision === 'refuse' ? 'text-danger-600' : 'text-neutral-400'
                  )} />
                  <div>
                    <p className="font-medium text-neutral-900">Refuse</p>
                    <p className="text-xs text-neutral-500">Reject this notarization</p>
                  </div>
                </button>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">
                  Notes (Required)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Document your reasoning..."
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  rows={3}
                />
              </div>
              
              <button
                onClick={handleSubmitDecision}
                disabled={!decision || !notes.trim()}
                className={cn(
                  'w-full py-2.5 rounded-lg font-medium transition-colors',
                  decision && notes.trim()
                    ? decision === 'approve'
                      ? 'bg-success-600 text-white hover:bg-success-700'
                      : 'bg-danger-600 text-white hover:bg-danger-700'
                    : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                )}
              >
                Submit Decision
              </button>
            </div>
          </div>
          
          {/* Policy Info */}
          <div className="bg-primary-50 rounded-xl border border-primary-200 p-4">
            <h4 className="font-medium text-primary-900 mb-2">Policy Requirements</h4>
            <ul className="space-y-1.5 text-sm text-primary-800">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-600" />
                Identity verification required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-600" />
                Human ceremony required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-600" />
                Final signoff required
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-success-600" />
                Evidence bundle required
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
