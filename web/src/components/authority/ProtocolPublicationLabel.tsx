import React from 'react';
import { cn } from '../../lib/utils';
import { Layers, Info, CheckCircle2, AlertCircle } from 'lucide-react';
import type { CaseState } from '../../types';

interface ProtocolPublicationLabelProps {
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  context?: 'inline' | 'banner';
  state?: CaseState;
}

export const ProtocolPublicationLabel: React.FC<ProtocolPublicationLabelProps> = ({
  className,
  showIcon = true,
  size = 'md',
  context = 'inline',
  state,
}) => {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5',
  };
  
  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
  };
  
  const getStatusConfig = () => {
    switch (state) {
      case 'PUBLISHED':
        return {
          label: 'Published',
          bgColor: 'bg-protocol-100',
          textColor: 'text-protocol-700',
          icon: CheckCircle2,
        };
      case 'PUBLICATION_PENDING':
        return {
          label: 'Publishing...',
          bgColor: 'bg-protocol-50',
          textColor: 'text-protocol-600',
          icon: Layers,
        };
      case 'PUBLICATION_FAILED':
        return {
          label: 'Publication Failed',
          bgColor: 'bg-warning-100',
          textColor: 'text-warning-700',
          icon: AlertCircle,
        };
      default:
        return {
          label: 'Protocol Layer',
          bgColor: 'bg-protocol-50',
          textColor: 'text-protocol-600',
          icon: Layers,
        };
    }
  };
  
  const config = getStatusConfig();
  const Icon = config.icon;
  
  if (context === 'banner') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border bg-protocol-50 border-protocol-200',
          state === 'PUBLICATION_FAILED' && 'bg-warning-50 border-warning-200',
          className
        )}
      >
        <Icon className={cn('flex-shrink-0 mt-0.5', iconSizes[size], config.textColor)} />
        <div>
          <p className={cn('font-medium', config.textColor)}>Protocol Publication</p>
          <p className="text-neutral-600 text-sm mt-1">
            Protocol publication is optional and downstream from legal completion. 
            It provides cryptographic proof and attestation on the blockchain, but does not 
            affect the legal validity of the notarization, which is established by the 
            off-chain human-supervised authority flow.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        config.bgColor,
        config.textColor,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className={iconSizes[size]} />}
      <span>{config.label}</span>
      {context === 'inline' && <Info className={cn('opacity-50', iconSizes[size])} />}
    </span>
  );
};
