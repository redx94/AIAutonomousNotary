import React from 'react';
import { Settings, Shield, Clock, Archive, AlertCircle } from 'lucide-react';

interface RetentionRule {
  id: string;
  category: string;
  retentionPeriod: string;
  legalBasis: string;
  deletionMethod: string;
  status: 'active' | 'review' | 'suspended';
}

const RETENTION_RULES: RetentionRule[] = [
  {
    id: 'rr-001',
    category: 'Notarization Records',
    retentionPeriod: '10 years',
    legalBasis: 'State notary statutes — minimum 10-year retention',
    deletionMethod: 'Cryptographic erasure + audit log',
    status: 'active',
  },
  {
    id: 'rr-002',
    category: 'Identity Proofing Documents',
    retentionPeriod: '7 years',
    legalBasis: 'AML/KYC compliance requirements',
    deletionMethod: 'Secure deletion with verification',
    status: 'active',
  },
  {
    id: 'rr-003',
    category: 'AI Analysis Reports',
    retentionPeriod: '5 years',
    legalBasis: 'Internal policy — AI accountability',
    deletionMethod: 'Archived to cold storage, then deletion',
    status: 'active',
  },
  {
    id: 'rr-004',
    category: 'Ceremony Recordings',
    retentionPeriod: '10 years',
    legalBasis: 'Evidentiary retention — remote notarization regulations',
    deletionMethod: 'Cryptographic erasure + audit log',
    status: 'active',
  },
  {
    id: 'rr-005',
    category: 'Evidence Bundles',
    retentionPeriod: 'Permanent',
    legalBasis: 'Blockchain publication — immutable record',
    deletionMethod: 'N/A — immutable',
    status: 'active',
  },
  {
    id: 'rr-006',
    category: 'Audit Logs',
    retentionPeriod: '7 years',
    legalBasis: 'SOC 2 / regulatory audit trail requirements',
    deletionMethod: 'Secure deletion with hash verification',
    status: 'review',
  },
  {
    id: 'rr-007',
    category: 'Refused Case Records',
    retentionPeriod: '5 years',
    legalBasis: 'Fraud investigation and liability protection',
    deletionMethod: 'Anonymization after retention period',
    status: 'active',
  },
];

const STATUS_STYLES = {
  active: 'bg-success-100 text-success-700',
  review: 'bg-warning-100 text-warning-700',
  suspended: 'bg-danger-100 text-danger-700',
};

export const RetentionPolicy: React.FC = () => {
  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Retention Policy</h2>
        <p className="text-neutral-600 mt-1">
          Data retention schedules for all records managed by the AI Autonomous Notary system.
        </p>
      </div>

      {/* Policy Notice */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800">
          <p className="font-medium">Compliant Mode — Human-Supervised Retention</p>
          <p className="mt-1">
            All retention schedules require human compliance officer approval before modification.
            Retention periods meet or exceed applicable state, federal, and international requirements.
            Deletion events are logged to the immutable audit trail.
          </p>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-success-50 flex items-center justify-center">
            <Archive className="w-5 h-5 text-success-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Active Rules</p>
            <p className="text-2xl font-bold text-neutral-900">
              {RETENTION_RULES.filter(r => r.status === 'active').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-warning-50 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-warning-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Under Review</p>
            <p className="text-2xl font-bold text-neutral-900">
              {RETENTION_RULES.filter(r => r.status === 'review').length}
            </p>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-neutral-200 p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-neutral-100 flex items-center justify-center">
            <Clock className="w-5 h-5 text-neutral-600" />
          </div>
          <div>
            <p className="text-xs text-neutral-500">Next Review</p>
            <p className="text-lg font-bold text-neutral-900">Q3 2026</p>
          </div>
        </div>
      </div>

      {/* Retention Rules Table */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50 flex items-center gap-2">
          <Settings className="w-4 h-4 text-neutral-500" />
          <span className="text-sm font-medium text-neutral-700">Retention Schedule</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-neutral-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Category</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Retention</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase hidden md:table-cell">Legal Basis</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase hidden lg:table-cell">Deletion Method</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-neutral-500 uppercase">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-50">
              {RETENTION_RULES.map(rule => (
                <tr key={rule.id} className="hover:bg-neutral-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-neutral-900">{rule.category}</td>
                  <td className="px-6 py-4 text-neutral-700 font-mono text-xs whitespace-nowrap">{rule.retentionPeriod}</td>
                  <td className="px-6 py-4 text-neutral-600 hidden md:table-cell max-w-xs">{rule.legalBasis}</td>
                  <td className="px-6 py-4 text-neutral-600 hidden lg:table-cell">{rule.deletionMethod}</td>
                  <td className="px-6 py-4">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[rule.status]}`}>
                      {rule.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Compliance Note */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 text-sm text-neutral-600">
        <p className="font-medium text-neutral-700 mb-1">Modification Policy</p>
        <p>
          Retention rules may only be modified by an authorized compliance officer following a documented
          review process. All changes are version-controlled and logged. Contact your compliance
          administrator to initiate a rule change request.
        </p>
      </div>
    </div>
  );
};
