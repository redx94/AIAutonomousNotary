import React from 'react';
import { cn } from '../../lib/utils';
import { CheckCircle2, Camera, CreditCard, User, ChevronRight, Shield } from 'lucide-react';

const steps = [
  { id: 'personal', label: 'Personal Details', icon: User },
  { id: 'id-front', label: 'ID Front', icon: CreditCard },
  { id: 'id-back', label: 'ID Back', icon: CreditCard },
  { id: 'selfie', label: 'Selfie', icon: Camera },
  { id: 'review', label: 'Review', icon: Shield },
];

export const IdentityProofing: React.FC = () => {
  const [currentStep, setCurrentStep] = React.useState(0);
  const [completedSteps, setCompletedSteps] = React.useState<number[]>([]);
  
  const handleCompleteStep = () => {
    if (!completedSteps.includes(currentStep)) {
      setCompletedSteps([...completedSteps, currentStep]);
    }
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  // const CurrentIcon = steps[currentStep].icon;
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900">Identity Verification</h2>
        <p className="text-neutral-600 mt-1">
          Verify your identity to proceed with notarization. This is required by law.
        </p>
      </div>
      
      {/* Stepper */}
      <div className="bg-white rounded-xl border border-neutral-200 p-6 mb-6">
        <div className="flex items-center justify-between">
          {steps.map((step, idx) => {
            const Icon = step.icon;
            const isCompleted = completedSteps.includes(idx);
            const isCurrent = idx === currentStep;
            const isPending = idx > currentStep;
            
            return (
              <React.Fragment key={step.id}>
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center transition-colors',
                      isCompleted && 'bg-success-500 text-white',
                      isCurrent && 'bg-primary-600 text-white',
                      isPending && 'bg-neutral-100 text-neutral-400'
                    )}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-xs mt-2 font-medium',
                      isCompleted && 'text-success-700',
                      isCurrent && 'text-primary-700',
                      isPending && 'text-neutral-400'
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={cn(
                      'flex-1 h-0.5 mx-2',
                      isCompleted ? 'bg-success-500' : 'bg-neutral-200'
                    )}
                  />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>
      
      {/* Step Content */}
      <div className="bg-white rounded-xl border border-neutral-200 p-8">
        {currentStep === 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-lg bg-primary-100 flex items-center justify-center">
                <User className="w-6 h-6 text-primary-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-neutral-900">Personal Details</h3>
                <p className="text-sm text-neutral-600">Confirm your personal information</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Full Name</label>
                <input
                  type="text"
                  defaultValue="Sarah Johnson"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  defaultValue="1985-03-15"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Email</label>
                <input
                  type="email"
                  defaultValue="sarah.johnson@example.com"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Phone</label>
                <input
                  type="tel"
                  defaultValue="+1-555-0123"
                  className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
            </div>
          </div>
        )}
        
        {currentStep === 1 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Capture ID Front</h3>
            <p className="text-neutral-600 mt-2 max-w-md mx-auto">
              Position the front of your government-issued ID within the frame. 
              Ensure all text is clearly visible.
            </p>
            <div className="mt-6 p-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300">
              <p className="text-neutral-500">Camera preview would appear here</p>
            </div>
          </div>
        )}
        
        {currentStep === 2 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <CreditCard className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Capture ID Back</h3>
            <p className="text-neutral-600 mt-2 max-w-md mx-auto">
              Position the back of your ID within the frame.
            </p>
            <div className="mt-6 p-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300">
              <p className="text-neutral-500">Camera preview would appear here</p>
            </div>
          </div>
        )}
        
        {currentStep === 3 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
              <Camera className="w-10 h-10 text-primary-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Take a Selfie</h3>
            <p className="text-neutral-600 mt-2 max-w-md mx-auto">
              Position your face within the circle. Look directly at the camera 
              and ensure good lighting.
            </p>
            <div className="mt-6 p-8 bg-neutral-50 rounded-xl border-2 border-dashed border-neutral-300">
              <p className="text-neutral-500">Camera preview would appear here</p>
            </div>
          </div>
        )}
        
        {currentStep === 4 && (
          <div className="text-center py-8">
            <div className="w-20 h-20 rounded-full bg-success-50 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-10 h-10 text-success-600" />
            </div>
            <h3 className="text-lg font-semibold text-neutral-900">Identity Verified</h3>
            <p className="text-neutral-600 mt-2 max-w-md mx-auto">
              Your identity has been successfully verified. You can now proceed 
              with the notarization process.
            </p>
            <div className="mt-6 p-4 bg-success-50 rounded-lg border border-success-200 max-w-md mx-auto">
              <div className="flex items-center gap-2 text-success-800">
                <Shield className="w-5 h-5" />
                <span className="font-medium">Verification Complete</span>
              </div>
              <p className="text-sm text-success-700 mt-1">
                All identity checks passed
              </p>
            </div>
          </div>
        )}
        
        {/* Navigation */}
        <div className="flex justify-between mt-8 pt-6 border-t border-neutral-100">
          <button
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
            className={cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              currentStep === 0
                ? 'text-neutral-300 cursor-not-allowed'
                : 'text-neutral-600 hover:text-neutral-900'
            )}
          >
            Back
          </button>
          
          {currentStep === steps.length - 1 ? (
            <a
              href="/signer/case"
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Continue to Case
              <ChevronRight className="w-4 h-4" />
            </a>
          ) : (
            <button
              onClick={handleCompleteStep}
              className="inline-flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Continue
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      
      {/* Security Note */}
      <div className="mt-6 p-4 bg-neutral-50 rounded-lg border border-neutral-200">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-neutral-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-neutral-700">Your data is secure</p>
            <p className="text-sm text-neutral-500 mt-1">
              Your identity information is encrypted and only used for this notarization. 
              We comply with all applicable privacy regulations.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
