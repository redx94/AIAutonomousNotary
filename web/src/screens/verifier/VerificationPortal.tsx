import React from 'react';
import { cn } from '../../lib/utils';
import { StatusBadge } from '../../components/ui/StatusBadge';
// import { LegalStatusCard } from '../../components/authority/LegalStatusCard';
import { ProtocolPublicationLabel } from '../../components/authority/ProtocolPublicationLabel';
import { EvidenceIntegrityCard } from '../../components/evidence/EvidenceIntegrityCard';
import { 
  Search, Upload, FileCheck, CheckCircle2, 
  XCircle, FileText, Hash, Clock 
} from 'lucide-react';

export const VerificationPortal: React.FC = () => {
  const [searchType, setSearchType] = React.useState<'document' | 'hash' | 'case'>('document');
  const [searchValue, setSearchValue] = React.useState('');
  const [isSearching, setIsSearching] = React.useState(false);
  const [result, setResult] = React.useState<'verified' | 'altered' | 'not_found' | null>(null);
  
  const handleVerify = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setResult('verified');
    }, 1500);
  };
  
  // Mock verification result
  const verificationData = result === 'verified' ? {
    status: 'verified',
    caseId: 'act-published-006',
    documentType: 'affidavit',
    actType: 'oath',
    notarizationTime: '2026-03-31T16:45:00Z',
    jurisdiction: 'US',
    authorityMode: 'human_commissioned',
    legalStatus: 'finalized_and_published',
    publicationStatus: 'published',
    bundleId: 'bundle-006-8f7d3a',
    contentHash: 'sha256:a1b2c3d4e5f6...',
  } : null;
  
  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <FileCheck className="w-8 h-8 text-primary-600" />
        </div>
        <h2 className="text-3xl font-semibold text-neutral-900">Verify a Notarization</h2>
        <p className="text-neutral-600 mt-2">
          Confirm the authenticity of any document notarized on our platform.
          No account required.
        </p>
      </div>
      
      {/* Search Box */}
      <div className="bg-white rounded-xl border border-neutral-200 shadow-sm p-6 mb-8">
        {/* Search Type Tabs */}
        <div className="flex gap-2 mb-6">
          {[
            { id: 'document', label: 'Upload Document', icon: Upload },
            { id: 'hash', label: 'Enter Hash', icon: Hash },
            { id: 'case', label: 'Case ID', icon: FileText },
          ].map((type) => {
            const Icon = type.icon;
            return (
              <button
                key={type.id}
                onClick={() => setSearchType(type.id as any)}
                className={cn(
                  'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
                  searchType === type.id
                    ? 'bg-primary-600 text-white'
                    : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'
                )}
              >
                <Icon className="w-4 h-4" />
                {type.label}
              </button>
            );
          })}
        </div>
        
        {/* Search Input */}
        <div className="flex gap-3">
          {searchType === 'document' ? (
            <div className="flex-1 border-2 border-dashed border-neutral-300 rounded-lg p-8 text-center hover:border-primary-400 transition-colors cursor-pointer">
              <Upload className="w-8 h-8 text-neutral-400 mx-auto mb-2" />
              <p className="text-sm text-neutral-600">Drop your document here or click to browse</p>
            </div>
          ) : (
            <input
              type="text"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={
                searchType === 'hash' 
                  ? 'Enter document hash (sha256:...)' 
                  : 'Enter case ID (act-...)'
              }
              className="flex-1 px-4 py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          )}
          <button
            onClick={handleVerify}
            disabled={isSearching || (searchType !== 'document' && !searchValue)}
            className={cn(
              'px-6 py-3 rounded-lg font-medium inline-flex items-center gap-2 transition-colors',
              isSearching || (searchType !== 'document' && !searchValue)
                ? 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            )}
          >
            {isSearching ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Verifying...
              </>
            ) : (
              <>
                <Search className="w-4 h-4" />
                Verify
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Results */}
      {result === 'verified' && verificationData && (
        <div className="space-y-6 animate-fade-in">
          {/* Success Banner */}
          <div className="bg-success-50 rounded-xl border border-success-200 p-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full bg-success-100 flex items-center justify-center flex-shrink-0">
                <CheckCircle2 className="w-7 h-7 text-success-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-success-900">Document Verified</h3>
                <p className="text-success-700 mt-1">
                  This document has been authenticated. The notarization is valid.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <StatusBadge state="PUBLISHED" size="md" />
                  <span className="text-sm text-success-700">
                    {new Date(verificationData.notarizationTime).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-neutral-200 p-5">
              <h4 className="font-semibold text-neutral-900 mb-4">Notarization Details</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">Case ID</span>
                  <code className="font-mono text-neutral-700">{verificationData.caseId}</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Document Type</span>
                  <span className="font-medium text-neutral-700 capitalize">{verificationData.documentType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Act Type</span>
                  <span className="font-medium text-neutral-700 capitalize">{verificationData.actType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Jurisdiction</span>
                  <span className="font-medium text-neutral-700">{verificationData.jurisdiction}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Authority</span>
                  <span className="font-medium text-neutral-700">
                    {verificationData.authorityMode === 'human_commissioned' ? 'Human Commissioned' : 'Autonomous'}
                  </span>
                </div>
              </div>
            </div>
            
            <EvidenceIntegrityCard 
              bundleId={verificationData.bundleId}
              contentHash={verificationData.contentHash}
              createdAt={verificationData.notarizationTime}
              artifactCount={9}
            />
          </div>
          
          {/* Protocol Status */}
          <ProtocolPublicationLabel 
            state="PUBLISHED" 
            context="banner"
          />
          
          {/* Download Certificate */}
          <div className="bg-white rounded-xl border border-neutral-200 p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-lg bg-primary-50 flex items-center justify-center">
                  <FileText className="w-6 h-6 text-primary-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-neutral-900">Verification Certificate</h4>
                  <p className="text-sm text-neutral-600">
                    Download a PDF certificate of this verification result
                  </p>
                </div>
              </div>
              <button className="px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors">
                Download
              </button>
            </div>
          </div>
        </div>
      )}
      
      {result === 'not_found' && (
        <div className="bg-neutral-50 rounded-xl border border-neutral-200 p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mx-auto mb-4">
            <XCircle className="w-8 h-8 text-neutral-400" />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">Notarization Not Found</h3>
          <p className="text-neutral-600 mt-2">
            We couldn't find a notarization matching your search. The document may not be notarized, 
            or the details may be incorrect.
          </p>
        </div>
      )}
      
      {/* Info Section */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <FileCheck className="w-6 h-6 text-primary-600" />
          </div>
          <h4 className="font-medium text-neutral-900">Document Integrity</h4>
          <p className="text-sm text-neutral-600 mt-2">
            We verify that the document hasn't been altered since notarization.
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <Clock className="w-6 h-6 text-primary-600" />
          </div>
          <h4 className="font-medium text-neutral-900">Timestamp Verification</h4>
          <p className="text-sm text-neutral-600 mt-2">
            Confirm exactly when the notarization was completed.
          </p>
        </div>
        <div className="text-center p-6">
          <div className="w-12 h-12 rounded-full bg-primary-50 flex items-center justify-center mx-auto mb-3">
            <Hash className="w-6 h-6 text-primary-600" />
          </div>
          <h4 className="font-medium text-neutral-900">Cryptographic Proof</h4>
          <p className="text-sm text-neutral-600 mt-2">
            Optional blockchain attestation for additional verification.
          </p>
        </div>
      </div>
    </div>
  );
};
