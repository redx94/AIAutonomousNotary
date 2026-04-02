import React from 'react';
import { useCaseStore } from '../../store/useCaseStore';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { StepTracker } from '../../components/ui/StepTracker';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
// import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { EventTimeline } from '../../components/evidence/EventTimeline';
import { mockEvents, mockAIAnalysis } from '../../data/mockCases';
import { cn } from '../../lib/utils';
import { FileText, User, Clock, ChevronRight, AlertCircle } from 'lucide-react';

export const CaseDetail: React.FC = () => {
  const { currentCase } = useCaseStore();
  
  // Use a mock case for demonstration
  const caseData = currentCase || {
    actId: 'act-review-003',
    documentId: 'doc-review-003',
    documentHash: '0xghi789...',
    actType: 'notarization',
    documentType: 'power_of_attorney',
    jurisdiction: 'US',
    signer: { signerId: 'signer-003', fullName: 'Sarah Johnson', email: 'sarah@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-04-01T15:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: false, riskScore: 75, analysisId: 'ai-003', fraudSignals: [{ type: 'anomaly_detected', severity: 'high', description: 'Unusual document formatting detected' }] },
    humanReviewStatus: { state: 'in_progress' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { createdAt: '2026-04-01T14:30:00Z' },
  };
  
  const aiAnalysis = mockAIAnalysis['ai-003'];
  
  const steps = [
    { id: 'intake', label: 'Document', description: 'Uploaded', status: 'completed' as const },
    { id: 'identity', label: 'Identity', description: 'Verified', status: 'completed' as const },
    { id: 'ai', label: 'AI Analysis', description: 'Needs review', status: 'completed' as const },
    { id: 'human', label: 'Authority Review', description: 'In progress', status: 'in_progress' as const },
    { id: 'ceremony', label: 'Session', description: 'Pending', status: 'pending' as const },
    { id: 'finalize', label: 'Finalized', description: 'Pending', status: 'pending' as const },
  ];
  
  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-neutral-500 mb-2">
          <a href="/signer" className="hover:text-neutral-700">Home</a>
          <ChevronRight className="w-4 h-4" />
          <span>My Case</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-neutral-900">
              Power of Attorney Notarization
            </h2>
            <p className="text-neutral-600 mt-1">
              Case ID: <code className="text-sm font-mono bg-neutral-100 px-1.5 py-0.5 rounded">{caseData.actId}</code>
            </p>
          </div>
          <StatusBadge 
            state={caseData.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' : 'DRAFT'} 
            size="lg"
          />
        </div>
      </div>
      
      {/* Progress Steps */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <StepTracker steps={steps} currentStepId="human" orientation="horizontal" />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Status */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Current Status</h3>
            
            <div className="p-4 bg-primary-50 rounded-lg border border-primary-200">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-primary-900">Awaiting Authority Review</p>
                  <p className="text-sm text-primary-700 mt-1">
                    A commissioned notary is reviewing your case. This typically takes 
                    15-30 minutes during business hours.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="mt-4 p-4 bg-warning-50 rounded-lg border border-warning-200">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-warning-600 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-warning-900">AI Flagged for Review</p>
                  <p className="text-sm text-warning-700 mt-1">
                    Our AI detected some anomalies in the document that require human review. 
                    This is normal for non-standard documents. The notary will make the final determination.
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          {/* AI Findings */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-neutral-900">AI Analysis Findings</h3>
              <AIAdvisoryLabel size="sm" />
            </div>
            
            {aiAnalysis && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg">
                  <span className="text-sm text-neutral-600">Risk Score</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-neutral-200 rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          'h-full',
                          aiAnalysis.riskScore > 70 ? 'bg-danger-500' :
                          aiAnalysis.riskScore > 30 ? 'bg-warning-500' :
                          'bg-success-500'
                        )}
                        style={{ width: `${aiAnalysis.riskScore}%` }}
                      />
                    </div>
                    <span className={cn(
                      'text-sm font-medium',
                      aiAnalysis.riskScore > 70 ? 'text-danger-700' :
                      aiAnalysis.riskScore > 30 ? 'text-warning-700' :
                      'text-success-700'
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
            )}
          </div>
          
          {/* Timeline */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h3 className="font-semibold text-neutral-900 mb-4">Case Timeline</h3>
            <EventTimeline events={mockEvents.slice(0, 6)} />
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          {/* Document Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-neutral-500" />
              Document
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Type</span>
                <span className="font-medium text-neutral-700 capitalize">{caseData.documentType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Act Type</span>
                <span className="font-medium text-neutral-700 capitalize">{caseData.actType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Jurisdiction</span>
                <span className="font-medium text-neutral-700">{caseData.jurisdiction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Created</span>
                <span className="font-medium text-neutral-700">
                  {new Date(caseData.timestamps.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
          
          {/* Signer Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-neutral-500" />
              Signer
            </h4>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Name</span>
                <span className="font-medium text-neutral-700">{caseData.signer.fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Identity</span>
                <span className="font-medium text-success-700">Verified</span>
              </div>
            </div>
          </div>
          
          {/* Authority Info */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-4">Authority</h4>
            <div className="space-y-3">
              <HumanAuthorityLabel context="inline" size="sm" />
              <ProtocolPublicationLabel context="inline" size="sm" state={caseData.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' : 'DRAFT'} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
