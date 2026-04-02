import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, Circle, AlertCircle } from 'lucide-react';

interface ChecklistItem {
  id: string;
  label: string;
  status: 'complete' | 'incomplete' | 'blocked' | 'optional';
  details?: string;
}

interface FinalizationChecklistProps {
  items: ChecklistItem[];
  className?: string;
  showSummary?: boolean;
}

export const FinalizationChecklist: React.FC<FinalizationChecklistProps> = ({
  items,
  className,
  showSummary = true,
}) => {
  const completeCount = items.filter(i => i.status === 'complete').length;
  const blockedCount = items.filter(i => i.status === 'blocked').length;
  const totalRequired = items.filter(i => i.status !== 'optional').length;
  const canFinalize = blockedCount === 0 && completeCount === totalRequired;
  
  return (
    <div className={cn('bg-white rounded-lg border border-neutral-200', className)}>
      {showSummary && (
        <div className={cn(
          'px-4 py-3 border-b rounded-t-lg',
          canFinalize ? 'bg-success-50 border-success-200' : 
          blockedCount > 0 ? 'bg-danger-50 border-danger-200' : 'bg-neutral-50'
        )}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {canFinalize ? (
                <CheckCircle2 className="w-5 h-5 text-success-600" />
              ) : blockedCount > 0 ? (
                <AlertCircle className="w-5 h-5 text-danger-600" />
              ) : (
                <Circle className="w-5 h-5 text-neutral-400" />
              )}
              <span className={cn(
                'font-medium',
                canFinalize ? 'text-success-700' : 
                blockedCount > 0 ? 'text-danger-700' : 'text-neutral-700'
              )}>
                {canFinalize ? 'Ready to Finalize' : 
                 blockedCount > 0 ? `${blockedCount} blocker${blockedCount > 1 ? 's' : ''} must be resolved` : 
                 'Finalization Checklist'}
              </span>
            </div>
            <span className="text-sm text-neutral-500">
              {completeCount}/{totalRequired} complete
            </span>
          </div>
        </div>
      )}
      
      <div className="divide-y divide-neutral-100">
        {items.map((item) => (
          <div
            key={item.id}
            className={cn(
              'px-4 py-3 flex items-start gap-3',
              item.status === 'blocked' && 'bg-danger-50/30'
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {item.status === 'complete' && (
                <CheckCircle2 className="w-5 h-5 text-success-500" />
              )}
              {item.status === 'incomplete' && (
                <Circle className="w-5 h-5 text-neutral-300" />
              )}
              {item.status === 'blocked' && (
                <XCircle className="w-5 h-5 text-danger-500" />
              )}
              {item.status === 'optional' && (
                <Circle className="w-5 h-5 text-neutral-200" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-medium',
                  item.status === 'complete' ? 'text-neutral-900' :
                  item.status === 'blocked' ? 'text-danger-700' :
                  item.status === 'optional' ? 'text-neutral-400' :
                  'text-neutral-700'
                )}>
                  {item.label}
                </span>
                {item.status === 'optional' && (
                  <span className="text-xs text-neutral-400">(optional)</span>
                )}
              </div>
              {item.details && (
                <p className={cn(
                  'text-xs mt-0.5',
                  item.status === 'blocked' ? 'text-danger-600' : 'text-neutral-500'
                )}>
                  {item.details}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
