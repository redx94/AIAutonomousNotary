import React from 'react';
import { AIAdvisoryLabel } from '../../components/authority/AIAdvisoryLabel';
import { RiskBandCard } from '../../components/evidence/RiskBandCard';
import { CheckCircle2, AlertTriangle, Info, ChevronRight } from 'lucide-react';
import { cn } from '../../lib/utils';

export const AIFindings: React.FC = () => {
  // Mock AI analysis results
  const analysis = {
    riskScore: 25,
    overallAssessment: 'clean' as const,
    documentFindings: [
      { category: 'Format', finding: 'Standard PDF format detected', severity: 'info' as const },
      { category: 'Content', finding: 'All required fields present', severity: 'info' as const },
      { category: 'Signatures', finding: '3 signature blocks identified', severity: 'info' as const },
    ],
    identityFindings: [
      { category: 'ID Document', finding: 'Valid government-issued ID detected', severity: 'info' as const },
      { category: 'Face Match', finding: 'High confidence face match (94%)', severity: 'info' as const },
    ],
    fraudSignals: [],
    confidence: 0.94,
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900">AI Analysis Results</h2>
        <p className="text-neutral-600 mt-1">
          Our AI has analyzed your document and identity verification.
        </p>
      </div>
      
      {/* AI Advisory Banner */}
      <AIAdvisoryLabel context="banner" className="mb-6" />
      
      {/* Overall Assessment */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="md:col-span-2">
          <RiskBandCard 
            riskScore={analysis.riskScore}
            fraudSignals={analysis.fraudSignals}
            showDetails={true}
          />
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-8 h-8 text-success-500" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Ready for Review</h3>
            <p className="text-sm text-neutral-600 mt-2">
              No issues requiring immediate attention
            </p>
            <div className="mt-4 pt-4 border-t border-neutral-100">
              <p className="text-xs text-neutral-500">Analysis Confidence</p>
              <p className="text-2xl font-semibold text-neutral-900">{(analysis.confidence * 100).toFixed(0)}%</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Detailed Findings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Document Findings */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <FileIcon className="w-5 h-5 text-primary-600" />
            Document Analysis
          </h3>
          <div className="space-y-3">
            {analysis.documentFindings.map((finding, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg">
                <Info className="w-4 h-4 text-neutral-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-neutral-700">{finding.finding}</p>
                  <p className="text-xs text-neutral-500">{finding.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        {/* Identity Findings */}
        <div className="bg-white rounded-xl border border-neutral-200 p-6">
          <h3 className="font-semibold text-neutral-900 mb-4 flex items-center gap-2">
            <UserIcon className="w-5 h-5 text-primary-600" />
            Identity Analysis
          </h3>
          <div className="space-y-3">
            {analysis.identityFindings.map((finding, idx) => (
              <div key={idx} className="flex items-start gap-3 p-3 bg-neutral-50 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-neutral-700">{finding.finding}</p>
                  <p className="text-xs text-neutral-500">{finding.category}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Next Steps */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6">
        <h3 className="font-semibold text-neutral-900 mb-4">What happens next?</h3>
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <span className="font-semibold text-primary-700">1</span>
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-neutral-900">Human Authority Review</h4>
            <p className="text-sm text-neutral-600 mt-1">
              A commissioned notary will review your case, including this AI analysis. 
              They make the final determination on whether to proceed with notarization.
            </p>
            <div className="mt-4 flex items-center gap-2 p-3 bg-warning-50 rounded-lg border border-warning-200">
              <AlertTriangle className="w-5 h-5 text-warning-600 flex-shrink-0" />
              <p className="text-sm text-warning-700">
                <span className="font-medium">Important:</span> AI findings are advisory only. 
                The notary may identify issues the AI missed, or disregard AI warnings based on their professional judgment.
              </p>
            </div>
          </div>
        </div>
        
        <div className="mt-6 flex justify-end">
          <a
            href="/signer/identity"
            className={cn(
              'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors',
              'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            Continue to Identity Check
            <ChevronRight className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
};

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function UserIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
