import React from 'react';
import { cn } from '../../lib/utils';
import { getRiskBand } from '../../lib/utils';
import { AlertTriangle, AlertCircle, CheckCircle2 } from 'lucide-react';

interface RiskBandCardProps {
  riskScore: number;
  showDetails?: boolean;
  fraudSignals?: { type: string; severity: string; description: string }[];
  className?: string;
}

export const RiskBandCard: React.FC<RiskBandCardProps> = ({
  riskScore,
  showDetails = true,
  fraudSignals = [],
  className,
}) => {
  const { label } = getRiskBand(riskScore);
  
  const getIcon = () => {
    if (riskScore <= 30) return CheckCircle2;
    if (riskScore <= 70) return AlertTriangle;
    return AlertCircle;
  };
  
  const getColors = () => {
    if (riskScore <= 30) return {
      bg: 'bg-success-50',
      border: 'border-success-200',
      text: 'text-success-700',
      bar: 'bg-success-500',
      icon: 'text-success-600',
    };
    if (riskScore <= 70) return {
      bg: 'bg-warning-50',
      border: 'border-warning-200',
      text: 'text-warning-700',
      bar: 'bg-warning-500',
      icon: 'text-warning-600',
    };
    return {
      bg: 'bg-danger-50',
      border: 'border-danger-200',
      text: 'text-danger-700',
      bar: 'bg-danger-500',
      icon: 'text-danger-600',
    };
  };
  
  const colors = getColors();
  const Icon = getIcon();
  
  const criticalSignals = fraudSignals.filter(s => 
    s.severity === 'high' || s.severity === 'critical'
  );
  
  return (
    <div className={cn(
      'rounded-lg border p-4',
      colors.bg,
      colors.border,
      className
    )}>
      <div className="flex items-start gap-3">
        <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', colors.icon)} />
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <h4 className={cn('font-semibold', colors.text)}>Risk Assessment</h4>
            <span className={cn('text-sm font-medium', colors.text)}>{label}</span>
          </div>
          
          {/* Risk score bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs text-neutral-600 mb-1">
              <span>Risk Score</span>
              <span className="font-mono font-medium">{riskScore}/100</span>
            </div>
            <div className="h-2 bg-white rounded-full overflow-hidden border border-neutral-200">
              <div
                className={cn('h-full transition-all duration-500', colors.bar)}
                style={{ width: `${riskScore}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-neutral-400 mt-1">
              <span>Low</span>
              <span>Medium</span>
              <span>High</span>
            </div>
          </div>
          
          {showDetails && fraudSignals.length > 0 && (
            <div className="mt-4 pt-3 border-t border-neutral-200/50">
              <p className="text-xs font-medium text-neutral-700 mb-2">
                Detected Signals ({fraudSignals.length})
              </p>
              <div className="space-y-1.5">
                {fraudSignals.slice(0, 3).map((signal, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-xs">
                    <span className={cn(
                      'w-1.5 h-1.5 rounded-full',
                      signal.severity === 'critical' && 'bg-danger-500',
                      signal.severity === 'high' && 'bg-danger-400',
                      signal.severity === 'medium' && 'bg-warning-500',
                      signal.severity === 'low' && 'bg-success-500'
                    )} />
                    <span className="text-neutral-700">{signal.description}</span>
                  </div>
                ))}
                {fraudSignals.length > 3 && (
                  <p className="text-xs text-neutral-500 pl-3.5">
                    +{fraudSignals.length - 3} more signals
                  </p>
                )}
              </div>
            </div>
          )}
          
          {criticalSignals.length > 0 && (
            <div className="mt-3 p-2 bg-danger-100/50 rounded border border-danger-200">
              <p className="text-xs text-danger-700 font-medium">
                {criticalSignals.length} critical signal{criticalSignals.length > 1 ? 's' : ''} require{criticalSignals.length === 1 ? 's' : ''} human review
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
