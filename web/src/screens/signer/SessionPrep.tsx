import React from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/utils';
import { Video, Clock, User, CheckCircle2, AlertCircle, ChevronRight, Calendar } from 'lucide-react';

export const SessionPrep: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900">Session Preparation</h2>
        <p className="text-neutral-600 mt-1">
          Review the details for your upcoming notarization session.
        </p>
      </div>
      
      {/* Assigned Notary */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Your Notary</h3>
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-semibold text-neutral-900">Jane Smith</h4>
            <p className="text-sm text-neutral-600">Commissioned Notary Public</p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span className="text-neutral-500">Commission #: 12345678</span>
              <span className="text-neutral-500">Jurisdiction: Massachusetts</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Session Details */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Session Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Calendar className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Scheduled For</p>
              <p className="font-medium text-neutral-900">April 3, 2026</p>
              <p className="text-sm text-neutral-600">2:00 PM EST</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Expected Duration</p>
              <p className="font-medium text-neutral-900">10-15 minutes</p>
              <p className="text-sm text-neutral-600">May vary based on questions</p>
            </div>
          </div>
          
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
              <Video className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-neutral-500">Session Type</p>
              <p className="font-medium text-neutral-900">Video Conference</p>
              <p className="text-sm text-neutral-600">Secure, encrypted connection</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Requirements Checklist */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <h3 className="font-semibold text-neutral-900 mb-4">Before Your Session</h3>
        <div className="space-y-3">
          {[
            { label: 'Valid government-issued photo ID', required: true },
            { label: 'Physical document to be notarized (if wet signature required)', required: false },
            { label: 'Pen for signing', required: true },
            { label: 'Quiet, well-lit location', required: true },
            { label: 'Stable internet connection', required: true },
            { label: 'Working camera and microphone', required: true },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 bg-neutral-50 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-success-500" />
              <span className="text-sm text-neutral-700">{item.label}</span>
              {!item.required && (
                <span className="text-xs text-neutral-400 ml-auto">(if applicable)</span>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* Recording Disclosure */}
      <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-neutral-500 flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-neutral-900">Session Recording</h4>
            <p className="text-sm text-neutral-600 mt-1">
              This session will be recorded for quality assurance and legal compliance. 
              The recording is encrypted and stored securely as part of your evidence bundle. 
              It may be retained for up to 7 years as required by law.
            </p>
          </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button className="flex-1 px-4 py-3 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors">
          Reschedule
        </button>
        <Link
          to="/signer/session"
          className={cn(
            'flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium',
            'hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2'
          )}
        >
          Join Session
          <ChevronRight className="w-4 h-4" />
        </Link>
      </div>
    </div>
  );
};
