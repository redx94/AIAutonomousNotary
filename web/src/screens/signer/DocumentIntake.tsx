import React from 'react';
import { cn } from '../../lib/utils';
import { Upload, File, CheckCircle2, AlertCircle, ChevronRight } from 'lucide-react';

export const DocumentIntake: React.FC = () => {
  const [isDragging, setIsDragging] = React.useState(false);
  const [file, setFile] = React.useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = React.useState(0);
  const [, setIsUploading] = React.useState(false);
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = () => {
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type === 'application/pdf') {
      setFile(droppedFile);
      simulateUpload();
    }
  };
  
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      simulateUpload();
    }
  };
  
  const simulateUpload = () => {
    setIsUploading(true);
    setUploadProgress(0);
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 200);
  };
  
  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-neutral-900">Document Upload</h2>
        <p className="text-neutral-600 mt-1">
          Upload the document you need notarized. We'll analyze it for you.
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Upload Area */}
        <div className="lg:col-span-2 space-y-6">
          {!file ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={cn(
                'border-2 border-dashed rounded-xl p-12 text-center transition-colors',
                isDragging 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-neutral-300 hover:border-neutral-400 bg-white'
              )}
            >
              <div className="w-16 h-16 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Upload className="w-8 h-8 text-primary-600" />
              </div>
              <h3 className="text-lg font-medium text-neutral-900">
                Drop your document here
              </h3>
              <p className="text-neutral-500 mt-2">
                or click to browse files
              </p>
              <p className="text-sm text-neutral-400 mt-4">
                PDF only, up to 50MB
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
                id="file-input"
              />
              <label
                htmlFor="file-input"
                className="inline-block mt-4 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium cursor-pointer hover:bg-primary-700 transition-colors"
              >
                Select File
              </label>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-neutral-200 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0">
                  <File className="w-6 h-6 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-neutral-900 truncate">{file.name}</h4>
                    {uploadProgress === 100 && (
                      <CheckCircle2 className="w-5 h-5 text-success-500" />
                    )}
                  </div>
                  <p className="text-sm text-neutral-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  
                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs text-neutral-500">
                        {uploadProgress === 100 ? 'Upload complete' : 'Uploading...'}
                      </span>
                      <span className="text-xs text-neutral-500">{uploadProgress}%</span>
                    </div>
                  </div>
                </div>
              </div>
              
              {uploadProgress === 100 && (
                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => setFile(null)}
                    className="px-4 py-2 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors"
                  >
                    Replace
                  </button>
                  <a
                    href="/signer/ai-findings"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                  >
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              )}
            </div>
          )}
          
          {/* Document Requirements */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <h4 className="font-semibold text-neutral-900 mb-4">Document Requirements</h4>
            <div className="space-y-3">
              {[
                { label: 'File format: PDF', met: true },
                { label: 'File size: Under 50MB', met: true },
                { label: 'Pages: All pages included', met: null },
                { label: 'Quality: Text is readable', met: null },
              ].map((req, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {req.met === true ? (
                    <CheckCircle2 className="w-5 h-5 text-success-500" />
                  ) : req.met === false ? (
                    <AlertCircle className="w-5 h-5 text-danger-500" />
                  ) : (
                    <div className="w-5 h-5 rounded-full border-2 border-neutral-300" />
                  )}
                  <span className={cn(
                    'text-sm',
                    req.met === true ? 'text-neutral-700' : 'text-neutral-500'
                  )}>
                    {req.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Sidebar */}
        <div className="space-y-6">
          <div className="bg-primary-50 rounded-xl border border-primary-100 p-5">
            <h4 className="font-semibold text-primary-900 mb-2">What happens next?</h4>
            <ol className="space-y-3 text-sm text-primary-800">
              <li className="flex gap-2">
                <span className="font-medium">1.</span>
                <span>Our AI will analyze your document for issues</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">2.</span>
                <span>You'll complete identity verification</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">3.</span>
                <span>A commissioned notary will review your case</span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium">4.</span>
                <span>You'll join a live session to complete the notarization</span>
              </li>
            </ol>
          </div>
          
          <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-5">
            <h4 className="font-semibold text-neutral-900 mb-2">Security</h4>
            <p className="text-sm text-neutral-600">
              Your document is encrypted and stored securely. Only authorized parties 
              can access it during the notarization process.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
