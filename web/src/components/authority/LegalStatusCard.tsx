import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../ui/StatusBadge';
import { Scale, Shield, CheckCircle2, XCircle } from 'lucide-react';
import type { CaseState } from '../../types';

interface LegalStatusCardProps {
  state: CaseState;
  finalizedAt?: string;
  authorityProvider?: string;
  className?: string;
}

export const LegalStatusCard: React.FC<LegalStatusCardProps> = ({
  state,
  finalizedAt,
  authorityProvider = 'human_commissioned',
  className,
}) => {
  const isFinalized = state === 'FINALIZED_OFFCHAIN' || state === 'PUBLISHED' || state === 'PUBLICATION_FAILED' || state === 'PUBLICATION_PENDING';
  const isRefused = state === 'REFUSED';
  
  const getStatusMessage = () => {
    if (isRefused) {
      return {
        title: 'Notarization Refused',
        description: 'The authority has refused this notarization. No legal validity is conferred.',
        icon: XCircle,
        iconColor: 'text-danger-600',
        bgColor: 'bg-danger-50',
        borderColor: 'border-danger-200',
      };
    }
    if (state === 'FINALIZED_OFFCHAIN') {
      return {
        title: 'Legally Finalized',
        description: 'This notarization has been completed under human-supervised authority and is legally valid.',
        icon: Scale,
        iconColor: 'text-success-600',
        bgColor: 'bg-success-50',
        borderColor: 'border-success-200',
      };
    }
    if (state === 'PUBLISHED') {
      return {
        title: 'Finalized & Published',
        description: 'Legally valid and cryptographically attested on the blockchain.',
        icon: CheckCircle2,
        iconColor: 'text-success-600',
        bgColor: 'bg-success-50',
        borderColor: 'border-success-200',
      };
    }
    if (state === 'PUBLICATION_FAILED') {
      return {
        title: 'Finalized (Publication Failed)',
        description: 'Your notarization is legally valid. Protocol publication did not complete, but this does not affect legal validity.',
        icon: Scale,
        iconColor: 'text-success-600',
        bgColor: 'bg-success-50',
        borderColor: 'border-success-200',
      };
    }
    return {
      title: 'In Progress',
      description: 'This notarization is still in progress and is not yet legally final.',
      icon: Shield,
      iconColor: 'text-primary-600',
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-200',
    };
  };
  
  const status = getStatusMessage();
  const Icon = status.icon;
  
  return (
    <div
      className={cn(
        'rounded-lg border p-4',
        status.bgColor,
        status.borderColor,
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Icon className={cn('w-6 h-6 flex-shrink-0 mt-0.5', status.iconColor)} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-neutral-900">{status.title}</h3>
            <StatusBadge state={state} size="sm" />
          </div>
          <p className="text-sm text-neutral-600 mt-1">{status.description}</p>
          
          {(isFinalized || isRefused) && finalizedAt && (
            <div className="mt-3 pt-3 border-t border-neutral-200/50">
              <div className="flex items-center justify-between text-sm">
                <span className="text-neutral-500">Finalized</span>
                <span className="font-medium text-neutral-700">
                  {new Date(finalizedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm mt-1">
                <span className="text-neutral-500">Authority</span>
                <span className="font-medium text-neutral-700">
                  {authorityProvider === 'human_commissioned' ? 'Human Commissioned Notary' : 'Autonomous'}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
