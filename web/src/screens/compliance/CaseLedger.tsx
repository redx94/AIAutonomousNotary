import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { mockCases } from '../../data/mockCases';
import { 
  Search, Filter, Download, ChevronRight, Calendar,
  FileText, User, Globe 
} from 'lucide-react';

export const CaseLedger: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  
  const filteredCases = mockCases.filter(c => {
    const matchesSearch = 
      c.actId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.signer.fullName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'finalized' && c.timestamps.finalizedAt) ||
      (statusFilter === 'pending' && !c.timestamps.finalizedAt) ||
      (statusFilter === 'refused' && c.humanReviewStatus.state === 'refused');
    return matchesSearch && matchesStatus;
  });
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Case Ledger</h2>
          <p className="text-neutral-600 mt-1">
            Complete record of all notarization cases
          </p>
        </div>
        <button className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases', value: mockCases.length, color: 'bg-neutral-100 text-neutral-700' },
          { label: 'Finalized', value: mockCases.filter(c => c.timestamps.finalizedAt).length, color: 'bg-success-100 text-success-700' },
          { label: 'Pending', value: mockCases.filter(c => !c.timestamps.finalizedAt && c.humanReviewStatus.state !== 'refused').length, color: 'bg-warning-100 text-warning-700' },
          { label: 'Refused', value: mockCases.filter(c => c.humanReviewStatus.state === 'refused').length, color: 'bg-danger-100 text-danger-700' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">{stat.label}</p>
            <p className={cn('text-2xl font-semibold mt-1', stat.color.split(' ')[1])}>{stat.value}</p>
          </div>
        ))}
      </div>
      
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-white p-4 rounded-xl border border-neutral-200">
        <div className="relative flex-1 min-w-64">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by case ID or signer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-neutral-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="all">All Statuses</option>
            <option value="finalized">Finalized</option>
            <option value="pending">Pending</option>
            <option value="refused">Refused</option>
          </select>
        </div>
      </div>
      
      {/* Ledger Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-50 border-b border-neutral-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Case ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Signer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Jurisdiction</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Publication</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Created</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredCases.map((c) => (
                <tr key={c.actId} className="hover:bg-neutral-50">
                  <td className="px-4 py-3">
                    <code className="text-xs font-mono text-neutral-700">{c.actId}</code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-900">{c.signer.fullName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-700 capitalize">{c.documentType}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-neutral-400" />
                      <span className="text-sm text-neutral-700">{c.jurisdiction}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge 
                      state={c.humanReviewStatus.state === 'refused' ? 'REFUSED' :
                             c.timestamps.finalizedAt ? 'FINALIZED_OFFCHAIN' :
                             c.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' :
                             'AI_ANALYZED'} 
                      size="sm"
                    />
                  </td>
                  <td className="px-4 py-3">
                    {c.timestamps.finalizedAt ? (
                      <ProtocolPublicationLabel 
                        state={c.evidenceBundleId?.includes('006') ? 'PUBLISHED' : 'PUBLICATION_PENDING'} 
                        size="sm"
                      />
                    ) : (
                      <span className="text-xs text-neutral-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(c.timestamps.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a
                      href={`/compliance/case?id=${c.actId}`}
                      className="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                    >
                      View
                      <ChevronRight className="w-4 h-4" />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {filteredCases.length === 0 && (
          <div className="p-12 text-center">
            <p className="text-neutral-500">No cases match your filters</p>
          </div>
        )}
      </div>
    </div>
  );
};
