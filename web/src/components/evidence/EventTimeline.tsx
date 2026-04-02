import React from 'react';
import { cn } from '../../lib/utils';
import { formatDateTime } from '../../lib/utils';
import type { CaseEvent } from '../../types';
import { 
  User, Bot, Shield, FileText, CheckCircle, XCircle, 
  Upload, Fingerprint, Gavel, Package, Layers 
} from 'lucide-react';

interface EventTimelineProps {
  events: CaseEvent[];
  className?: string;
}

const eventTypeConfig: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  'SIGNER_INTAKE_COMPLETED': { icon: User, label: 'Signer Intake', color: 'text-primary-600' },
  'DOCUMENT_INTAKE_COMPLETED': { icon: Upload, label: 'Document Uploaded', color: 'text-primary-600' },
  'AI_ANALYSIS_COMPLETED': { icon: Bot, label: 'AI Analysis', color: 'text-advisory-600' },
  'IDENTITY_VERIFICATION_COMPLETED': { icon: Fingerprint, label: 'Identity Verified', color: 'text-success-600' },
  'POLICY_DECISION_ISSUED': { icon: Shield, label: 'Policy Decision', color: 'text-primary-600' },
  'HUMAN_REVIEW_OPENED': { icon: FileText, label: 'Review Opened', color: 'text-primary-600' },
  'HUMAN_REVIEW_COMPLETED': { icon: CheckCircle, label: 'Review Completed', color: 'text-success-600' },
  'CEREMONY_COMPLETED': { icon: Gavel, label: 'Ceremony Completed', color: 'text-success-600' },
  'ACT_AUTHORIZED': { icon: Shield, label: 'Act Authorized', color: 'text-success-600' },
  'ACT_REFUSED': { icon: XCircle, label: 'Act Refused', color: 'text-danger-600' },
  'CERTIFICATE_COMPLETED': { icon: FileText, label: 'Certificate Created', color: 'text-success-600' },
  'FINAL_RECORD_SIGNED': { icon: CheckCircle, label: 'Record Signed', color: 'text-success-600' },
  'EVIDENCE_BUNDLE_CREATED': { icon: Package, label: 'Evidence Bundle', color: 'text-primary-600' },
  'PROTOCOL_PUBLICATION_ATTEMPTED': { icon: Layers, label: 'Publication Attempted', color: 'text-protocol-600' },
  'PROTOCOL_PUBLICATION_SUCCEEDED': { icon: Layers, label: 'Published', color: 'text-protocol-600' },
  'PROTOCOL_PUBLICATION_FAILED': { icon: Layers, label: 'Publication Failed', color: 'text-warning-600' },
};

export const EventTimeline: React.FC<EventTimelineProps> = ({
  events,
  className,
}) => {
  const sortedEvents = [...events].sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
  
  return (
    <div className={cn('space-y-0', className)}>
      {sortedEvents.map((event, index) => {
        const config = eventTypeConfig[event.eventType] || { 
          icon: FileText, 
          label: event.eventType,
          color: 'text-neutral-600' 
        };
        const Icon = config.icon;
        const isLast = index === sortedEvents.length - 1;
        
        return (
          <div key={event.eventId} className="relative flex gap-4">
            {/* Timeline line */}
            {!isLast && (
              <div className="absolute left-4 top-8 bottom-0 w-px bg-neutral-200" />
            )}
            
            {/* Icon */}
            <div className={cn(
              'relative z-10 flex-shrink-0 w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center',
              'bg-white'
            )}>
              <Icon className={cn('w-4 h-4', config.color)} />
            </div>
            
            {/* Content */}
            <div className={cn(
              'flex-1 pb-6',
              isLast && 'pb-0'
            )}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm text-neutral-900">{config.label}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {formatDateTime(event.timestamp)}
                  </p>
                </div>
                <span className="text-xs text-neutral-400 font-mono">
                  {event.actor}
                </span>
              </div>
              
              {event.details && Object.keys(event.details).length > 0 && (
                <div className="mt-2 p-2 bg-neutral-50 rounded text-xs">
                  {Object.entries(event.details).slice(0, 3).map(([key, value]) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-neutral-500 capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="text-neutral-700 font-mono">{String(value).slice(0, 40)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
