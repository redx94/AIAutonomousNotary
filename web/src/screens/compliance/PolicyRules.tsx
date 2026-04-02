import React from 'react';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { PolicyDecision } from '../../types';
import { CheckCircle2, Shield } from 'lucide-react';

export const PolicyRules: React.FC = () => {
  const [policy, setPolicy] = React.useState<PolicyDecision | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    // Load a representative policy decision for display
    caseAdapter.getPolicyDecision('policy-005').then(p => {
      setPolicy(p ?? null);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-semibold text-neutral-900">Policy Rules</h2>
        <p className="text-neutral-600 mt-1">
          Policy rules define the required authority mode, supervision requirements, flow steps,
          and evidence artifacts for each notarization. These are evaluated at intake and
          enforced before any ceremony or finalization.
        </p>
      </div>

      {/* Authority Boundary Notice */}
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-primary-600 flex-shrink-0 mt-0.5" />
        <div className="text-sm text-primary-800">
          <p className="font-medium">Compliant Mode — Human Authority Required</p>
          <p className="mt-1">
            In compliant mode, policy mandates human supervision, human ceremony, and human final sign-off.
            AI analysis is advisory only and does not constitute authority. Protocol publication is
            downstream and does not establish legal validity.
          </p>
        </div>
      </div>

      {policy ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Core Requirements */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900">Core Requirements</h3>
            <div className="space-y-3 text-sm">
              {[
                { label: 'Policy Version', value: policy.policyVersion, mono: true },
                { label: 'Required Authority Mode', value: policy.requiredAuthorityMode.replace(/_/g, ' ') },
                { label: 'Max Risk Score Allowed', value: String(policy.maxRiskScore) },
                { label: 'Human Supervision', value: policy.requireHumanSupervision ? 'Required' : 'Not required' },
                { label: 'Human Ceremony', value: policy.requireHumanCeremony ? 'Required' : 'Not required' },
                { label: 'Human Final Sign-off', value: policy.requireHumanFinalSignoff ? 'Required' : 'Not required' },
              ].map((row) => (
                <div key={row.label} className="flex justify-between gap-4 py-1.5 border-b border-neutral-50">
                  <span className="text-neutral-500">{row.label}</span>
                  {row.mono
                    ? <code className="text-xs font-mono text-neutral-700">{row.value}</code>
                    : <span className="font-medium text-neutral-800 capitalize text-right">{row.value}</span>
                  }
                </div>
              ))}
            </div>
          </div>

          {/* Required Flow Steps */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900">Required Flow Steps</h3>
            <ul className="space-y-2">
              {policy.requiredFlowSteps.map((step, i) => (
                <li key={step} className="flex items-center gap-3 text-sm">
                  <span className="w-5 h-5 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-medium flex-shrink-0">
                    {i + 1}
                  </span>
                  <span className="text-neutral-800 capitalize">{step.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Required Evidence Artifacts */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900">Required Evidence Artifacts</h3>
            <ul className="space-y-2">
              {policy.requiredEvidenceArtifacts.map((artifact) => (
                <li key={artifact} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0" />
                  <code className="font-mono text-neutral-700">{artifact}</code>
                </li>
              ))}
            </ul>
          </div>

          {/* Blocked Fraud Signals */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900">Blocked Fraud Signal Types</h3>
            <p className="text-xs text-neutral-500">
              Cases matching any of these signals are blocked by policy and cannot proceed without
              explicit override.
            </p>
            <ul className="space-y-2">
              {policy.blockedFraudSignals.map((sig) => (
                <li key={sig} className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-danger-500 flex-shrink-0" />
                  <code className="font-mono text-neutral-700">{sig}</code>
                </li>
              ))}
            </ul>
          </div>

          {/* Required Identity Checks */}
          <div className="bg-white rounded-xl border border-neutral-200 p-5 space-y-4">
            <h3 className="font-semibold text-neutral-900">Required Identity Checks</h3>
            <ul className="space-y-2">
              {policy.requiredIdentityChecks.map((check) => (
                <li key={check} className="flex items-center gap-2 text-sm">
                  <CheckCircle2 className="w-4 h-4 text-success-600 flex-shrink-0" />
                  <span className="text-neutral-700 capitalize">{check.replace(/_/g, ' ')}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Policy Warnings */}
          <div className="bg-warning-50 rounded-xl border border-warning-200 p-5 space-y-4">
            <h3 className="font-semibold text-warning-900">Policy Warnings</h3>
            <p className="text-xs text-warning-700">
              These warnings are appended to all policy decisions and must be acknowledged by operators.
            </p>
            <ul className="space-y-2">
              {policy.warnings.map((w, i) => (
                <li key={i} className="text-sm text-warning-800 bg-warning-100 rounded-lg px-3 py-2">
                  {w}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-neutral-200 p-8 text-center text-neutral-500 text-sm">
          No policy data available.
        </div>
      )}
    </div>
  );
};
