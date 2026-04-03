import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { QueueItem } from '../../types';
import { AlertCircle, ChevronRight, CheckCircle2 } from 'lucide-react';

const EXCEPTION_REASONS: Record<string, string> = {
  'high': 'High risk score — requires senior notary review',
  'medium': 'Manual identity check required',
  'low': 'Scheduled for standard review',
};

export const NotaryExceptions: React.FC = () => {
  const navigate = useNavigate();
  const [exceptions, setExceptions] = React.useState<QueueItem[]>([]);
  const [resolved, setResolved] = React.useState<Set<string>>(new Set());
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    caseAdapter.getQueue().then(items => {
      setExceptions(items.filter(i => i.currentBlocker || i.riskBand === 'high'));
      setLoading(false);
    });
  }, []);

  const handleResolve = (caseId: string) => {
    setResolved(prev => new Set([...prev, caseId]));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const pending = exceptions.filter(e => !resolved.has(e.caseId));
  const resolvedList = exceptions.filter(e => resolved.has(e.caseId));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Exceptions &amp; Escalations</h2>
        <p className="text-neutral-600 mt-1">
          Cases with blockers, elevated risk, or requiring senior notary attention.
        </p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Exceptions', value: exceptions.length, color: 'text-neutral-900' },
          { label: 'Pending', value: pending.length, color: 'text-warning-700' },
          { label: 'Resolved This Session', value: resolvedList.length, color: 'text-success-700' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-neutral-200 p-4">
            <p className="text-sm text-neutral-500">{s.label}</p>
            <p className={cn('text-3xl font-bold mt-1', s.color)}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending Exceptions */}
      {pending.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 bg-warning-50">
            <h3 className="font-semibold text-warning-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Pending Exceptions ({pending.length})
            </h3>
          </div>
          <ul className="divide-y divide-neutral-100">
            {pending.map(item => (
              <li key={item.caseId} className="px-6 py-4 flex items-start gap-4">
                <div className="w-9 h-9 rounded-lg bg-warning-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <AlertCircle className="w-5 h-5 text-warning-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-neutral-900">{item.signerName}</p>
                  <code className="text-xs font-mono text-neutral-500">{item.caseId}</code>
                  <p className="text-sm text-warning-700 mt-1">
                    {item.currentBlocker ?? EXCEPTION_REASONS[item.riskBand] ?? 'Review required'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    onClick={() => navigate(`/notary/case/${item.caseId}`)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Review
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleResolve(item.caseId)}
                    className="px-3 py-1.5 border border-neutral-300 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-50 transition-colors"
                  >
                    Resolve
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resolved */}
      {resolvedList.length > 0 && (
        <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 bg-success-50">
            <h3 className="font-semibold text-success-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Resolved This Session ({resolvedList.length})
            </h3>
          </div>
          <ul className="divide-y divide-neutral-100">
            {resolvedList.map(item => (
              <li key={item.caseId} className="px-6 py-4 flex items-center gap-4">
                <CheckCircle2 className="w-5 h-5 text-success-500 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-neutral-700">{item.signerName}</p>
                  <code className="text-xs font-mono text-neutral-400">{item.caseId}</code>
                </div>
                <span className="text-xs text-success-600 font-medium">Resolved</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {exceptions.length === 0 && (
        <div className="text-center py-16">
          <CheckCircle2 className="w-12 h-12 text-success-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-neutral-700">No exceptions</h3>
          <p className="text-neutral-500 mt-2">All cases are progressing normally.</p>
        </div>
      )}
    </div>
  );
};
