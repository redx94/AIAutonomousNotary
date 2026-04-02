import React from 'react';
import { cn } from '../../lib/utils';
import { Gavel, CheckCircle2, Video, FileText } from 'lucide-react';
import type { CeremonyRecord } from '../../types';
import { formatDateTime } from '../../lib/utils';

interface CeremonyArtifactPanelProps {
  ceremonyRecord?: CeremonyRecord;
  isPending?: boolean;
  className?: string;
}

export const CeremonyArtifactPanel: React.FC<CeremonyArtifactPanelProps> = ({
  ceremonyRecord,
  isPending = false,
  className,
}) => {
  if (isPending) {
    return (
      <div className={cn(
        'rounded-lg border border-dashed border-neutral-300 bg-neutral-50 p-6',
        className
      )}>
        <div className="flex flex-col items-center justify-center text-center">
          <Gavel className="w-10 h-10 text-neutral-300 mb-3" />
          <h4 className="font-medium text-neutral-700">Ceremony Pending</h4>
          <p className="text-sm text-neutral-500 mt-1 max-w-sm">
            The ceremony will be conducted during the live session with a commissioned notary.
          </p>
        </div>
      </div>
    );
  }
  
  if (!ceremonyRecord) {
    return (
      <div className={cn(
        'rounded-lg border border-danger-200 bg-danger-50 p-4',
        className
      )}>
        <div className="flex items-center gap-2 text-danger-700">
          <Gavel className="w-5 h-5" />
          <span className="font-medium">No Ceremony Record</span>
        </div>
        <p className="text-sm text-danger-600 mt-1">
          A ceremony record is required for finalization.
        </p>
      </div>
    );
  }
  
  return (
    <div className={cn(
      'rounded-lg border bg-white p-4',
      className
    )}>
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
          <CheckCircle2 className="w-5 h-5 text-success-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-neutral-900">Ceremony Completed</h4>
            <span className="text-xs text-success-700 bg-success-50 px-2 py-0.5 rounded-full font-medium">
              {ceremonyRecord.providerType === 'human_commissioned' ? 'Human Supervised' : 'Autonomous'}
            </span>
          </div>
          
          <p className="text-sm text-neutral-600 mt-1">
            Completed {formatDateTime(ceremonyRecord.confirmedAt)}
          </p>
          
          <div className="mt-4 space-y-3">
            <div className="p-3 bg-neutral-50 rounded-lg">
              <p className="text-xs font-medium text-neutral-700 mb-2">Acknowledgments</p>
              <ul className="space-y-1.5">
                {ceremonyRecord.acknowledgments.map((ack, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-neutral-600">
                    <CheckCircle2 className="w-4 h-4 text-success-500 flex-shrink-0 mt-0.5" />
                    <span>{ack}</span>
                  </li>
                ))}
              </ul>
            </div>
            
            <div className="flex items-center gap-4 text-xs">
              {ceremonyRecord.recordingRef && (
                <div className="flex items-center gap-1.5 text-neutral-600">
                  <Video className="w-4 h-4" />
                  <span>Recording available</span>
                </div>
              )}
              <div className="flex items-center gap-1.5 text-neutral-600">
                <FileText className="w-4 h-4" />
                <span>Artifact: {ceremonyRecord.artifactRef.slice(0, 16)}...</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
