import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, XCircle, AlertCircle, User } from 'lucide-react';
import type { HumanReview } from '../../types';
import { formatDateTime } from '../../lib/utils';

interface ReviewDecisionPanelProps {
  review?: HumanReview;
  isPending?: boolean;
  onDecision?: (decision: 'approve' | 'refuse') => void;
  className?: string;
}

export const ReviewDecisionPanel: React.FC<ReviewDecisionPanelProps> = ({
  review,
  isPending = false,
  onDecision,
  className,
}) => {
  if (isPending) {
    return (
      <div className={cn(
        'rounded-lg border border-neutral-200 bg-white p-4',
        className
      )}>
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-5 h-5 text-primary-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-neutral-900">Authority Review Required</h4>
            <p className="text-sm text-neutral-600 mt-1">
              A commissioned notary must review this case before proceeding.
            </p>
            
            {onDecision && (
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => onDecision('approve')}
                  className="flex-1 px-4 py-2 bg-success-600 text-white rounded-lg font-medium hover:bg-success-700 transition-colors"
                >
                  Approve
                </button>
                <button
                  onClick={() => onDecision('refuse')}
                  className="flex-1 px-4 py-2 bg-white border border-danger-300 text-danger-700 rounded-lg font-medium hover:bg-danger-50 transition-colors"
                >
                  Refuse
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  if (!review) {
    return (
      <div className={cn(
        'rounded-lg border border-neutral-200 bg-neutral-50 p-4',
        className
      )}>
        <div className="flex items-center gap-2 text-neutral-500">
          <AlertCircle className="w-5 h-5" />
          <span className="text-sm">No review recorded yet</span>
        </div>
      </div>
    );
  }
  
  const isApproved = review.decision === 'approve' && review.finalApproval;
  const isRefused = review.finalRefusal || review.decision === 'refuse';
  
  return (
    <div className={cn(
      'rounded-lg border p-4',
      isApproved ? 'bg-success-50 border-success-200' :
      isRefused ? 'bg-danger-50 border-danger-200' :
      'bg-white border-neutral-200',
      className
    )}>
      <div className="flex items-start gap-3">
        <div className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0',
          isApproved ? 'bg-success-100' :
          isRefused ? 'bg-danger-100' :
          'bg-primary-100'
        )}>
          {isApproved ? (
            <CheckCircle2 className="w-5 h-5 text-success-600" />
          ) : isRefused ? (
            <XCircle className="w-5 h-5 text-danger-600" />
          ) : (
            <AlertCircle className="w-5 h-5 text-primary-600" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={cn(
              'font-semibold',
              isApproved ? 'text-success-800' :
              isRefused ? 'text-danger-800' :
              'text-neutral-900'
            )}>
              {isApproved ? 'Approved' : isRefused ? 'Refused' : 'Reviewed'}
            </h4>
            <span className="text-xs text-neutral-500">
              {formatDateTime(review.reviewedAt)}
            </span>
          </div>
          
          <div className="mt-2 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-neutral-500">Reviewer</span>
              <span className="font-medium text-neutral-700">{review.reviewerName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-500">Decision</span>
              <span className={cn(
                'font-medium',
                isApproved ? 'text-success-700' :
                isRefused ? 'text-danger-700' :
                'text-neutral-700'
              )}>
                {review.decision.charAt(0).toUpperCase() + review.decision.slice(1)}
              </span>
            </div>
          </div>
          
          {review.notes && (
            <div className="mt-3 p-3 bg-white/50 rounded border border-neutral-200">
              <p className="text-xs font-medium text-neutral-700 mb-1">Notes</p>
              <p className="text-sm text-neutral-600">{review.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
