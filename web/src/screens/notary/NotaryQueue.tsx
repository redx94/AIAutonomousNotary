import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
// import { RiskBandCard } from '../../components/evidence/RiskBandCard';
import { mockCases } from '../../data/mockCases';
import { 
  Clock, FileText, User, 
  ChevronRight, Filter, Search 
} from 'lucide-react';

export const NotaryQueue: React.FC = () => {
  const [filter, setFilter] = React.useState<'all' | 'ready' | 'review' | 'high-risk'>('all');
  
  // Transform cases into queue items
  const queueItems = mockCases
    .filter(c => c.aiAnalysisStatus.state === 'completed')
    .filter(c => {
      if (filter === 'all') return true;
      if (filter === 'ready') return c.identityProofingStatus.state === 'completed' && c.humanReviewStatus.state === 'pending';
      if (filter === 'review') return c.humanReviewStatus.state === 'in_progress';
      if (filter === 'high-risk') return (c.aiAnalysisStatus.riskScore || 0) > 50;
      return true;
    })
    .map(c => ({
      caseId: c.actId,
      signerName: c.signer.fullName,
      actType: c.actType,
      documentType: c.documentType,
      jurisdiction: c.jurisdiction,
      identityStatus: c.identityProofingStatus.state,
      riskScore: c.aiAnalysisStatus.riskScore || 0,
      aiFlags: c.aiAnalysisStatus.fraudSignals?.length || 0,
      status: c.humanReviewStatus.state === 'in_progress' ? 'in_review' : 
              c.identityProofingStatus.state !== 'completed' ? 'identity_pending' : 'ready',
      submittedAt: c.timestamps.createdAt,
    }));
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Notary Queue</h2>
          <p className="text-neutral-600 mt-1">
            Review and process pending notarization requests
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">{queueItems.length} cases</span>
        </div>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4 bg-white p-2 rounded-lg border border-neutral-200">
        <div className="flex items-center gap-2 px-3">
          <Filter className="w-4 h-4 text-neutral-400" />
          <span className="text-sm text-neutral-600">Filter:</span>
        </div>
        {[
          { id: 'all', label: 'All Cases' },
          { id: 'ready', label: 'Ready for Review' },
          { id: 'review', label: 'In Review' },
          { id: 'high-risk', label: 'High Risk' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as any)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === f.id
                ? 'bg-primary-100 text-primary-700'
                : 'text-neutral-600 hover:bg-neutral-100'
            )}
          >
            {f.label}
          </button>
        ))}
        <div className="flex-1" />
        <div className="relative">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search cases..."
            className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>
      
      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Case</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Document</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Identity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Risk</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Submitted</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {queueItems.map((item) => (
                <tr key={item.caseId} className="hover:bg-neutral-50">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-neutral-100 flex items-center justify-center">
                        <User className="w-4 h-4 text-neutral-500" />
                      </div>
                      <div>
                        <p className="font-medium text-neutral-900">{item.signerName}</p>
                        <code className="text-xs font-mono text-neutral-500">{item.caseId}</code>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-700 capitalize">{item.documentType}</span>
                    </div>
                    <span className="text-xs text-neutral-500">{item.jurisdiction}</span>
                  </td>
                  <td className="px-4 py-4">
                    <span className={cn(
                      'inline-flex items-center gap-1 text-sm',
                      item.identityStatus === 'completed' ? 'text-success-700' : 'text-warning-700'
                    )}>
                      {item.identityStatus === 'completed' ? 'Verified' : 'Pending'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-2 h-2 rounded-full',
                        item.riskScore <= 30 ? 'bg-success-500' :
                        item.riskScore <= 70 ? 'bg-warning-500' :
                        'bg-danger-500'
                      )} />
                      <span className="text-sm text-neutral-700">{item.riskScore}/100</span>
                      {item.aiFlags > 0 && (
                        <span className="text-xs text-warning-600 bg-warning-50 px-1.5 py-0.5 rounded">
                          {item.aiFlags} flag{item.aiFlags > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <StatusBadge 
                      state={item.status === 'in_review' ? 'REVIEW_PENDING' : 
                             item.status === 'identity_pending' ? 'IDENTITY_PENDING' :
                             'REVIEW_COMPLETE'} 
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                      <Clock className="w-3.5 h-3.5" />
                      {new Date(item.submittedAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <a
                      href={`/notary/case?id=${item.caseId}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      {item.status === 'in_review' ? 'Continue' : 'Review'}
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {queueItems.length === 0 && (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-neutral-400" />
            </div>
            <h3 className="font-medium text-neutral-900">No cases match this filter</h3>
            <p className="text-sm text-neutral-500 mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};
