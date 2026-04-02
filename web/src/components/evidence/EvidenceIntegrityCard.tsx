import React from 'react';
import { cn } from '../../lib/utils';
import { FileCheck, Hash, Clock } from 'lucide-react';
import { formatHash, formatDateTime } from '../../lib/utils';

interface EvidenceIntegrityCardProps {
  bundleId: string;
  contentHash: string;
  createdAt: string;
  artifactCount: number;
  className?: string;
}

export const EvidenceIntegrityCard: React.FC<EvidenceIntegrityCardProps> = ({
  bundleId,
  contentHash,
  createdAt,
  artifactCount,
  className,
}) => {
  return (
    <div className={cn('bg-white rounded-lg border border-neutral-200 p-4', className)}>
      <div className="flex items-center gap-2 mb-3">
        <FileCheck className="w-5 h-5 text-success-600" />
        <h4 className="font-semibold text-neutral-900">Evidence Bundle</h4>
      </div>
      
      <div className="space-y-3">
        <div className="flex items-start gap-2">
          <span className="text-xs text-neutral-500 w-20 flex-shrink-0">Bundle ID</span>
          <code className="text-xs font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded">
            {formatHash(bundleId, 12)}
          </code>
        </div>
        
        <div className="flex items-start gap-2">
          <Hash className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-neutral-500 w-16">Content Hash</span>
          <code className="text-xs font-mono text-neutral-700 bg-neutral-100 px-2 py-0.5 rounded truncate">
            {formatHash(contentHash, 16)}
          </code>
        </div>
        
        <div className="flex items-start gap-2">
          <Clock className="w-3.5 h-3.5 text-neutral-400 mt-0.5 flex-shrink-0" />
          <span className="text-xs text-neutral-500 w-16">Created</span>
          <span className="text-xs text-neutral-700">{formatDateTime(createdAt)}</span>
        </div>
        
        <div className="flex items-start gap-2">
          <span className="text-xs text-neutral-500 w-20">Artifacts</span>
          <span className="text-xs font-medium text-neutral-700">{artifactCount} files</span>
        </div>
      </div>
      
      <div className="mt-4 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-success-500" />
          <span className="text-xs text-success-700 font-medium">Integrity Verified</span>
        </div>
      </div>
    </div>
  );
};
