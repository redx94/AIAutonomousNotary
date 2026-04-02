import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { QueueItem } from '../../types';
import {
  Clock, FileText, User,
  ChevronRight, Filter, Search,
} from 'lucide-react';

export const NotaryQueue: React.FC = () => {
  const navigate = useNavigate();
  const [filter, setFilter] = React.useState<'all' | 'ready' | 'review' | 'high-risk'>('all');
  const [searchTerm, setSearchTerm] = React.useState('');
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    caseAdapter.getQueue().then(q => { setItems(q); setLoading(false); });
  }, []);

  const visibleItems = items.filter(item => {
    const matchesFilter =
      filter === 'all' ||
      (filter === 'ready' && item.identityStatus === 'completed' && item.requiredAction === 'Begin review') ||
      (filter === 'review' && item.requiredAction === 'Complete review') ||
      (filter === 'high-risk' && item.riskBand === 'high');
    const matchesSearch =
      !searchTerm ||
      item.signerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.caseId.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Notary Queue</h2>
          <p className="text-neutral-600 mt-1">Review and process pending notarization requests</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-neutral-500">{visibleItems.length} cases</span>
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
            onClick={() => setFilter(f.id as typeof filter)}
            className={cn(
              'px-3 py-1.5 rounded-md text-sm font-medium transition-colors',
              filter === f.id ? 'bg-primary-100 text-primary-700' : 'text-neutral-600 hover:bg-neutral-100'
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
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-4 py-1.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          />
        </div>
      </div>

      {/* Queue Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-neutral-50 border-b border-neutral-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Case</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Act</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Identity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Risk</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Blocker</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {visibleItems.map((item) => (
                  <tr
                    key={item.caseId}
                    className="hover:bg-neutral-50 cursor-pointer"
                    onClick={() => navigate(`/notary/case/${item.caseId}`)}
                  >
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
                        <span className="text-sm text-neutral-700 capitalize">{item.actType}</span>
                      </div>
                      <span className="text-xs text-neutral-500">{item.jurisdiction}</span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={cn(
                        'text-sm',
                        item.identityStatus === 'completed' ? 'text-success-700' : 'text-warning-700'
                      )}>
                        {item.identityStatus === 'completed' ? 'Verified' : 'Pending'}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          'w-2 h-2 rounded-full',
                          item.riskBand === 'low' ? 'bg-success-500' :
                          item.riskBand === 'medium' ? 'bg-warning-500' :
                          'bg-danger-500'
                        )} />
                        <span className="text-sm text-neutral-700 capitalize">{item.riskBand}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <StatusBadge
                        state={item.requiredAction === 'Complete review' ? 'REVIEW_PENDING' : 'REVIEW_COMPLETE'}
                        size="sm"
                      />
                    </td>
                    <td className="px-4 py-4">
                      {item.currentBlocker ? (
                        <span className="text-xs text-warning-700 bg-warning-50 px-2 py-1 rounded-full">
                          {item.currentBlocker}
                        </span>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-neutral-400">
                          <Clock className="w-3.5 h-3.5" />
                          No blocker
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors">
                        {item.requiredAction === 'Complete review' ? 'Continue' : 'Review'}
                        <ChevronRight className="w-4 h-4" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {visibleItems.length === 0 && (
              <div className="p-12 text-center">
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-neutral-400" />
                </div>
                <h3 className="font-medium text-neutral-900">No cases match this filter</h3>
                <p className="text-sm text-neutral-500 mt-1">Try adjusting your filters</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
