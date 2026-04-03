import React from 'react';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { CaseEvent } from '../../types';
import { formatDateTime } from '../../lib/utils';
import { FileText, Search, Download } from 'lucide-react';

const EVENT_LABELS: Record<string, string> = {
  case_created: 'Case Created',
  document_uploaded: 'Document Uploaded',
  ai_analysis_complete: 'AI Analysis Completed',
  identity_verified: 'Identity Verified',
  policy_evaluated: 'Policy Evaluated',
  review_started: 'Review Started',
  review_decision: 'Review Decision Submitted',
  ceremony_completed: 'Ceremony Completed',
  finalized: 'Case Finalized',
  publication_submitted: 'Publication Submitted',
  publication_confirmed: 'Publication Confirmed',
  publication_failed: 'Publication Failed',
};

const EVENT_COLORS: Record<string, string> = {
  case_created: 'bg-neutral-100 text-neutral-600',
  document_uploaded: 'bg-blue-100 text-blue-700',
  ai_analysis_complete: 'bg-purple-100 text-purple-700',
  identity_verified: 'bg-success-100 text-success-700',
  policy_evaluated: 'bg-primary-100 text-primary-700',
  review_started: 'bg-warning-100 text-warning-700',
  review_decision: 'bg-primary-100 text-primary-700',
  ceremony_completed: 'bg-success-100 text-success-700',
  finalized: 'bg-success-100 text-success-700',
  publication_submitted: 'bg-blue-100 text-blue-700',
  publication_confirmed: 'bg-success-100 text-success-700',
  publication_failed: 'bg-danger-100 text-danger-700',
};

export const AuditTrail: React.FC = () => {
  const [events, setEvents] = React.useState<CaseEvent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [searchTerm, setSearchTerm] = React.useState('');

  React.useEffect(() => {
    // Load events for all cases by sampling known case IDs from mock data
    const knownCaseIds = [
      'act-draft-001', 'act-id-002', 'act-ai-003', 'act-review-004',
      'act-finalized-005', 'act-published-006', 'act-refused-007', 'act-pubfail-008',
    ];
    Promise.all(knownCaseIds.map(id => caseAdapter.getCaseEvents(id)))
      .then(results => {
        const all = results.flat().sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        );
        setEvents(all);
        setLoading(false);
      });
  }, []);

  const filtered = events.filter(e =>
    !searchTerm ||
    e.eventType.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.actId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.actor.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-semibold text-neutral-900">Audit Trail</h2>
          <p className="text-neutral-600 mt-1">
            Immutable chronological log of all case events across the notarization system.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          <button className="flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm text-neutral-700 hover:bg-neutral-50 transition-colors">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: events.length },
          { label: 'Cases Covered', value: new Set(events.map(e => e.actId)).size },
          { label: 'Unique Actors', value: new Set(events.map(e => e.actor)).size },
          { label: 'Showing', value: filtered.length },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-neutral-200 p-4">
            <p className="text-xs text-neutral-500 uppercase tracking-wide">{s.label}</p>
            <p className="text-2xl font-bold text-neutral-900 mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Event Log */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
          <FileText className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">
            {filtered.length} event{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
            <p className="text-neutral-500">No events match your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-neutral-100">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Timestamp</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Event</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Case</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-50">
                {filtered.map(e => (
                  <tr key={e.eventId} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-6 py-3 text-neutral-500 whitespace-nowrap font-mono text-xs">
                      {formatDateTime(e.timestamp)}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${EVENT_COLORS[e.eventType] ?? 'bg-neutral-100 text-neutral-600'}`}>
                        {EVENT_LABELS[e.eventType] ?? e.eventType}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      <code className="font-mono text-xs text-neutral-500">{e.actId}</code>
                    </td>
                    <td className="px-6 py-3 text-neutral-700">{e.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
