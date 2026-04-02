import React from 'react';
import { cn } from '../../lib/utils';
import { Video, Mic, MicOff, VideoOff, Phone, MessageSquare, Clock } from 'lucide-react';
import { StepTracker } from '../../components/ui/StepTracker';
import { HumanAuthorityLabel } from '../../components/authority/HumanAuthorityLabel';

export const LiveSession: React.FC = () => {
  const [isMuted, setIsMuted] = React.useState(false);
  const [isVideoOff, setIsVideoOff] = React.useState(false);
  
  const sessionSteps = [
    { id: 'connect', label: 'Connected', status: 'completed' as const },
    { id: 'verify', label: 'Identity Verified', status: 'completed' as const },
    { id: 'review', label: 'Document Review', status: 'in_progress' as const },
    { id: 'ceremony', label: 'Ceremony', status: 'pending' as const },
    { id: 'sign', label: 'Sign & Seal', status: 'pending' as const },
  ];
  
  return (
    <div className="h-[calc(100vh-200px)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-neutral-900">Live Notarization Session</h2>
          <div className="flex items-center gap-2 mt-1">
            <Clock className="w-4 h-4 text-neutral-500" />
            <span className="text-sm text-neutral-600">Session started 5 minutes ago</span>
          </div>
        </div>
        <HumanAuthorityLabel context="inline" />
      </div>
      
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Video Area */}
        <div className="lg:col-span-3 bg-neutral-900 rounded-xl overflow-hidden relative">
          {/* Main Video - Notary */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="w-24 h-24 rounded-full bg-neutral-700 flex items-center justify-center mx-auto mb-4">
                <span className="text-3xl text-neutral-400">JS</span>
              </div>
              <p className="text-white font-medium">Jane Smith, Notary</p>
              <p className="text-neutral-400 text-sm">Commission #12345678</p>
            </div>
          </div>
          
          {/* Self View */}
          <div className="absolute bottom-4 right-4 w-48 h-36 bg-neutral-800 rounded-lg overflow-hidden border-2 border-neutral-700">
            <div className="w-full h-full flex items-center justify-center">
              {isVideoOff ? (
                <VideoOff className="w-8 h-8 text-neutral-500" />
              ) : (
                <span className="text-xl text-neutral-400">SJ</span>
              )}
            </div>
            <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-neutral-900/80 rounded text-xs text-white">
              You
            </div>
          </div>
          
          {/* Controls */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
            <button
              onClick={() => setIsMuted(!isMuted)}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                isMuted ? 'bg-danger-500 text-white' : 'bg-neutral-700 text-white hover:bg-neutral-600'
              )}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setIsVideoOff(!isVideoOff)}
              className={cn(
                'w-12 h-12 rounded-full flex items-center justify-center transition-colors',
                isVideoOff ? 'bg-danger-500 text-white' : 'bg-neutral-700 text-white hover:bg-neutral-600'
              )}
            >
              {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
            </button>
            <button className="w-12 h-12 rounded-full bg-danger-500 text-white flex items-center justify-center hover:bg-danger-600 transition-colors">
              <Phone className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="bg-white rounded-xl border border-neutral-200 flex flex-col">
          {/* Session Progress */}
          <div className="p-4 border-b border-neutral-100">
            <h3 className="font-semibold text-neutral-900 mb-3">Session Progress</h3>
            <StepTracker steps={sessionSteps} currentStepId="review" orientation="vertical" />
          </div>
          
          {/* Document Preview */}
          <div className="p-4 border-b border-neutral-100 flex-1">
            <h3 className="font-semibold text-neutral-900 mb-3">Document</h3>
            <div className="bg-neutral-100 rounded-lg p-4 text-center">
              <p className="text-sm text-neutral-500">Document preview</p>
              <p className="text-xs text-neutral-400 mt-1">Page 1 of 5</p>
            </div>
          </div>
          
          {/* Chat */}
          <div className="p-4">
            <div className="flex items-center gap-2 text-sm text-neutral-600 mb-3">
              <MessageSquare className="w-4 h-4" />
              <span>Session Messages</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="p-2 bg-neutral-50 rounded">
                <span className="font-medium text-neutral-700">Notary:</span>
                <span className="text-neutral-600 ml-1">Please confirm you can see and hear me clearly.</span>
              </div>
              <div className="p-2 bg-primary-50 rounded">
                <span className="font-medium text-primary-700">You:</span>
                <span className="text-primary-600 ml-1">Yes, everything is clear.</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Notary Controls Notice */}
      <div className="mt-4 p-4 bg-primary-50 rounded-lg border border-primary-200">
        <div className="flex items-start gap-3">
          <HumanAuthorityLabel context="inline" size="sm" />
          <p className="text-sm text-primary-700">
            The notary controls all legally meaningful transitions during this session. 
            Please follow their instructions. Do not sign until explicitly directed.
          </p>
        </div>
      </div>
    </div>
  );
};
