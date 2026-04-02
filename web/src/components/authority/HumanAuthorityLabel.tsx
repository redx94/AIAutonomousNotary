import React from 'react';
import { cn } from '../../lib/utils';
import { Shield, CheckCircle2 } from 'lucide-react';

interface HumanAuthorityLabelProps {
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  context?: 'inline' | 'banner';
  status?: 'pending' | 'active' | 'completed';
}

export const HumanAuthorityLabel: React.FC<HumanAuthorityLabelProps> = ({
  className,
  showIcon = true,
  size = 'md',
  context = 'inline',
  status = 'active',
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
  
  if (context === 'banner') {
    return (
      <div
        className={cn(
          'flex items-start gap-3 p-4 rounded-lg border bg-primary-50 border-primary-200',
          className
        )}
      >
        <Shield className={cn('text-primary-600 flex-shrink-0 mt-0.5', iconSizes[size])} />
        <div>
          <p className="font-medium text-primary-800">Human Authority</p>
          <p className="text-primary-600 text-sm mt-1">
            This step involves human-supervised authority review. In compliant mode, 
            legal validity is derived from human authority execution, not from AI or protocol publication.
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 font-medium rounded-full',
        status === 'completed' 
          ? 'bg-success-100 text-success-700' 
          : 'bg-primary-100 text-primary-700',
        sizeClasses[size],
        className
      )}
    >
      {showIcon && (
        status === 'completed' 
          ? <CheckCircle2 className={iconSizes[size]} />
          : <Shield className={iconSizes[size]} />
      )}
      <span>{status === 'completed' ? 'Authority Completed' : 'Human Authority'}</span>
    </span>
  );
};
