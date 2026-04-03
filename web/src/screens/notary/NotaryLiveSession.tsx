import React from 'react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';
import * as caseAdapter from '../../services/adapters/caseAdapter';
import type { QueueItem } from '../../types';
import { Video, Mic, MicOff, VideoOff, Clock, ChevronLeft, User } from 'lucide-react';

export const NotaryLiveSession: React.FC = () => {
  const navigate = useNavigate();
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  const [activeCase, setActiveCase] = React.useState<QueueItem | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    caseAdapter.getQueue().then(items => {
      const inProgress = items.find(i => i.requiredAction === 'Complete review') ?? items[0] ?? null;
      setActiveCase(inProgress);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!activeCase) {
    return (
      <div className="text-center py-16">
        <Video className="w-12 h-12 text-neutral-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-neutral-700">No active session</h3>
        <p className="text-neutral-500 mt-2">There are no cases currently in a live session.</p>
        <button
          onClick={() => navigate('/notary')}
          className="mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700"
        >
          Return to Queue
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/notary')}
            className="flex items-center gap-1 text-neutral-500 hover:text-neutral-700 text-sm"
          >
            <ChevronLeft className="w-4 h-4" />
            Queue
          </button>
          <div>
            <h2 className="text-xl font-semibold text-neutral-900">Live Notarization Session</h2>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock className="w-4 h-4 text-neutral-500" />
              <span className="text-sm text-neutral-600">
                Case <code className="font-mono">{activeCase.caseId}</code> — {activeCase.signerName}
              </span>
            </div>
          </div>
        </div>
        <HumanAuthorityLabel context="inline" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-[calc(100vh-280px)]">
        {/* Video Area */}
        <div className="lg:col-span-3 bg-neutral-900 rounded-xl overflow-hidden relative min-h-[360px]">
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-neutral-700 flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-neutral-400" />
              </div>
              <p className="text-white font-medium">{activeCase.signerName}</p>
              <p className="text-neutral-400 text-sm capitalize">{activeCase.actType} · {activeCase.jurisdiction}</p>
            </div>
          </div>

          {/* Self View */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-neutral-800 rounded-lg overflow-hidden border-2 border-neutral-700 flex items-center justify-center">
            {isVideoOff ? (
              <VideoOff className="w-8 h-8 text-neutral-500" />
            ) : (
              <span className="text-xl text-neutral-400">You</span>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-neutral-900/80 rounded text-xs text-white">
              You (Notary)
            </div>
          </div>

          {/* Controls */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              onClick={() => setIsMuted(m => !m)}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                isMuted ? 'bg-danger-600 hover:bg-danger-700' : 'bg-neutral-700 hover:bg-neutral-600'
              )}
            >
              {isMuted ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => setIsVideoOff(v => !v)}
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                isVideoOff ? 'bg-danger-600 hover:bg-danger-700' : 'bg-neutral-700 hover:bg-neutral-600'
              )}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5 text-white" /> : <Video className="w-5 h-5 text-white" />}
            </button>
            <button
              onClick={() => navigate(`/notary/case/${activeCase.caseId}`)}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 rounded-full text-white text-sm font-medium transition-colors"
            >
              Open Case
            </button>
          </div>
        </div>

        {/* Session Info */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-neutral-200 p-4 space-y-3">
            <h3 className="font-semibold text-neutral-900 text-sm">Session Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-neutral-500">Signer</span>
                <span className="font-medium text-neutral-900">{activeCase.signerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Act Type</span>
                <span className="font-medium text-neutral-900 capitalize">{activeCase.actType}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Jurisdiction</span>
                <span className="font-medium text-neutral-900">{activeCase.jurisdiction}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Identity</span>
                <span className={cn(
                  'font-medium',
                  activeCase.identityStatus === 'completed' ? 'text-success-700' : 'text-warning-700'
                )}>
                  {activeCase.identityStatus === 'completed' ? 'Verified' : 'Pending'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-500">Risk Band</span>
                <span className={cn(
                  'font-medium capitalize',
                  activeCase.riskBand === 'low' ? 'text-success-700' :
                  activeCase.riskBand === 'medium' ? 'text-warning-700' : 'text-danger-700'
                )}>
                  {activeCase.riskBand}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => navigate(`/notary/case/${activeCase.caseId}`)}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors"
          >
            Review Case
          </button>
          <button
            onClick={() => navigate('/notary')}
            className="w-full px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg text-sm font-medium hover:bg-neutral-50 transition-colors"
          >
            Back to Queue
          </button>
        </div>
      </div>
    </div>
  );
};
