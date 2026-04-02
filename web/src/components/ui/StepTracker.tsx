import React from 'react';
import { cn } from '../../lib/utils';
import { Check, Loader2 } from 'lucide-react';

interface Step {
  id: string;
  label: string;
  description?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'blocked';
}

interface StepTrackerProps {
  steps: Step[];
  currentStepId?: string;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}

export const StepTracker: React.FC<StepTrackerProps> = ({
  steps,
  currentStepId,
  orientation = 'horizontal',
  className,
}) => {
  const isVertical = orientation === 'vertical';
  
  return (
    <div
      className={cn(
        isVertical ? 'flex flex-col space-y-0' : 'flex items-start',
        className
      )}
    >
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        const isCurrent = step.id === currentStepId;
        
        return (
          <div
            key={step.id}
            className={cn(
              'flex',
              isVertical 
                ? 'flex-row items-start' 
                : 'flex-col items-center flex-1'
            )}
          >
            {/* Step indicator */}
            <div className="flex items-center">
              <div
                className={cn(
                  'flex items-center justify-center rounded-full border-2 transition-colors',
                  step.status === 'completed' && 'bg-success-500 border-success-500 text-white',
                  step.status === 'in_progress' && 'bg-primary-50 border-primary-500 text-primary-600',
                  step.status === 'blocked' && 'bg-danger-50 border-danger-300 text-danger-500',
                  step.status === 'pending' && 'bg-white border-neutral-300 text-neutral-400',
                  isVertical ? 'w-8 h-8' : 'w-10 h-10'
                )}
              >
                {step.status === 'completed' && <Check className={isVertical ? 'w-4 h-4' : 'w-5 h-5'} />}
                {step.status === 'in_progress' && <Loader2 className={cn('animate-spin', isVertical ? 'w-4 h-4' : 'w-5 h-5')} />}
                {(step.status === 'pending' || step.status === 'blocked') && (
                  <span className={isVertical ? 'text-sm font-medium' : 'text-sm font-semibold'}>{index + 1}</span>
                )}
              </div>
              
              {/* Connector line */}
              {!isLast && (
                <div
                  className={cn(
                    'transition-colors',
                    isVertical
                      ? 'hidden'
                      : 'flex-1 h-0.5 mx-2',
                    step.status === 'completed' ? 'bg-success-500' : 'bg-neutral-200'
                  )}
                />
              )}
            </div>
            
            {/* Step label */}
            <div
              className={cn(
                'mt-2 text-center',
                isVertical && 'ml-3 mt-0 text-left flex-1'
              )}
            >
              <p
                className={cn(
                  'font-medium text-sm',
                  isCurrent && 'text-primary-700',
                  step.status === 'completed' && 'text-success-700',
                  step.status === 'blocked' && 'text-danger-700',
                  !isCurrent && step.status !== 'completed' && step.status !== 'blocked' && 'text-neutral-600'
                )}
              >
                {step.label}
              </p>
              {step.description && (
                <p className="text-xs text-neutral-500 mt-0.5">{step.description}</p>
              )}
            </div>
            
            {/* Vertical connector */}
            {isVertical && !isLast && (
              <div
                className={cn(
                  'absolute left-4 w-0.5 h-full mt-8',
                  step.status === 'completed' ? 'bg-success-500' : 'bg-neutral-200'
                )}
                style={{ height: 'calc(100% - 2rem)' }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
