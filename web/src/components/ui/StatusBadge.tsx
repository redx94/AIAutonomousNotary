import React from 'react';
import { cn } from '../../lib/utils';
import type { CaseState } from '../../types';

interface StatusBadgeProps {
  state: CaseState | string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const stateConfig: Record<string, { label: string; variant: string }> = {
  // Draft states
  DRAFT: { label: 'Draft', variant: 'neutral' },
  INTAKE_COMPLETE: { label: 'Intake Complete', variant: 'info' },
  
  // AI states
  AI_ANALYZED: { label: 'AI Analyzed', variant: 'advisory' },
  
  // Identity states
  IDENTITY_PENDING: { label: 'Identity Pending', variant: 'warning' },
  IDENTITY_COMPLETE: { label: 'Identity Complete', variant: 'success' },
  
  // Policy states
  POLICY_BLOCKED: { label: 'Blocked', variant: 'danger' },
  
  // Review states
  REVIEW_PENDING: { label: 'Awaiting Review', variant: 'warning' },
  REVIEW_COMPLETE: { label: 'Review Complete', variant: 'success' },
  
  // Ceremony states
  CEREMONY_PENDING: { label: 'Session Pending', variant: 'warning' },
  CEREMONY_COMPLETE: { label: 'Session Complete', variant: 'success' },
  
  // Finalization states
  FINALIZED_OFFCHAIN: { label: 'Finalized', variant: 'success' },
  REFUSED: { label: 'Refused', variant: 'danger' },
  
  // Publication states
  PUBLICATION_PENDING: { label: 'Publishing', variant: 'protocol' },
  PUBLISHED: { label: 'Published', variant: 'protocol' },
  PUBLICATION_FAILED: { label: 'Publication Failed', variant: 'warning' },
  
  // Generic
  pending: { label: 'Pending', variant: 'warning' },
  completed: { label: 'Completed', variant: 'success' },
  failed: { label: 'Failed', variant: 'danger' },
};

const variantStyles: Record<string, string> = {
  neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200',
  info: 'bg-primary-50 text-primary-700 border-primary-200',
  advisory: 'bg-advisory-100 text-advisory-600 border-advisory-200',
  success: 'bg-success-50 text-success-700 border-success-200',
  warning: 'bg-warning-50 text-warning-700 border-warning-200',
  danger: 'bg-danger-50 text-danger-700 border-danger-200',
  protocol: 'bg-protocol-50 text-protocol-700 border-protocol-200',
};

const sizeStyles: Record<string, string> = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  state,
  size = 'md',
  className,
}) => {
  const config = stateConfig[state] || { label: state, variant: 'neutral' };
  
  return (
    <span
      className={cn(
        'inline-flex items-center font-medium rounded-full border',
        variantStyles[config.variant],
        sizeStyles[size],
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full mr-1.5',
          config.variant === 'neutral' && 'bg-neutral-400',
          config.variant === 'info' && 'bg-primary-500',
          config.variant === 'advisory' && 'bg-advisory-500',
          config.variant === 'success' && 'bg-success-500',
          config.variant === 'warning' && 'bg-warning-500',
          config.variant === 'danger' && 'bg-danger-500',
          config.variant === 'protocol' && 'bg-protocol-500'
        )}
      />
      {config.label}
    </span>
  );
};
