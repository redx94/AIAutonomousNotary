import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  File,
  Fingerprint,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FilePlus,
  KeyRound,
  ShieldCheck,
  Languages,
  Link,
  Users,
  Building2,
  Gavel,
  Banknote,
  GraduationCap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

// Mock AI and Blockchain Functions (Replace with actual implementations)
const mockAIValidation = async (document: string, identity: string): Promise<{ isValid: boolean; report?: string }> => {
  // Simulate AI processing delay
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Simulate AI validation logic (replace with your actual AI model integration)
  if (!document || !identity) {
    return { isValid: false, report: 'Document and identity information are required.' };
  }

  // Very basic check for demonstration
  const isDocumentValid = document.length > 10;
  const isIdentityValid = identity.length > 5;

  if (isDocumentValid && isIdentityValid) {
    return {
      isValid: true,
      report: 'Document and identity verification successful.  No issues detected.',
    };
  } else if (!isDocumentValid) {
      return { isValid: false, report: 'Document is too short or appears invalid.' };
  } else {
      return { isValid: false, report: 'Identity information is too short or appears invalid.' };
  }
};

const mockBlockchainMintNFT = async (
  documentHash: string,
  timestamp: number,
  notary: string,
  documentType: string,
  parties?: string[]
): Promise<string> => {
  // Simulate blockchain transaction delay
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Mock NFT minting (replace with your actual blockchain interaction - e.g., using a library like ethers.js)
  const mockNftId = `NFT-${Math.random().toString(36).substring(2, 15)}`;
  console.log(
    `Minting NFT for document hash: ${documentHash} at ${timestamp} by notary: ${notary}.  Type: ${documentType}. Parties: ${parties?.join(', ') || 'N/A'}`
  );
  return mockNftId;
};

const AIAutonomousNotary = () => {
  const [document, setDocument] = useState('');
  const [identity, setIdentity] = useState('');
  const [documentType, setDocumentType] = useState('');  // Added document type
  const [parties, setParties] = useState<string[]>([]);
  const [validationResult, setValidationResult] = useState<{ isValid: boolean; report?: string } | null>(null);
  const [nftId, setNftId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleNotarize = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setValidationResult(null);
    setNftId(null);

    try {
      // 1. AI Validation
      const aiResult = await mockAIValidation(document, identity);
      setValidationResult(aiResult);

      if (!aiResult.isValid) {
        throw new Error('Document validation failed.');
      }

      // 2. Document Hashing (In a real app, use a library like CryptoJS)
      const documentHash = `HASH-${document}-${Date.now()}`; // Mock hash

      // 3. Get Timestamp
      const timestamp = Date.now();

      // 4. Notary Identity (In a real app, this would come from the user's wallet)
      const notary = 'AIAutonomousNotary-System';

      // 5. Blockchain Transaction (Mint NFT)
      const newNftId = await mockBlockchainMintNFT(documentHash, timestamp, notary, documentType, parties);
      setNftId(newNftId);
    } catch (err: any) {
      setError(err.message || 'An error occurred during notarization.');
      setValidationResult({isValid: false, report: err.message || 'An error occurred.'});
    } finally {
      setIsLoading(false);
    }
  }, [document, identity, documentType, parties]);

  const resetForm = () => {
        setDocument('');
        setIdentity('');
        setDocumentType('');
        setParties([]);
        setValidationResult(null);
        setNftId(null);
        setError(null);
  }

  return (
    <div
      className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-black p-4 md:p-8"
    >
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="text-center">
          <motion.h1
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-4xl sm:text-5xl md:text-6xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400"
          >
            AIAutonomousNotary
          </motion.h1>
          <p className="text-gray-400 mt-4">
            Secure and Trustworthy AI-Powered Digital Notarization
          </p>
        </div>

        <div
          className="bg-white/5 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-white/10 space-y-6"
        >
          <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
            <Gavel className="w-6 h-6" />
            Notarize Your Document
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="document" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <File className="w-4 h-4" />
                Document
              </label>
              <Textarea
                id="document"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                placeholder="Paste your document text here..."
                className="w-full bg-black/20 text-white border-purple-500/30 rounded-lg placeholder:text-gray-500 min-h-[120px] resize-y"
              />
            </div>
            <div>
              <label htmlFor="identity" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <Fingerprint className="w-4 h-4" />
                Identity Information
              </label>
              <Input
                id="identity"
                type="text"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="Enter your name or ID..."
                className="w-full bg-black/20 text-white border-purple-500/30 rounded-lg placeholder:text-gray-500"
              />
            </div>
             <div>
              <label htmlFor="documentType" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                <FilePlus className="w-4 h-4" />
                Document Type
              </label>
              <Input
                id="documentType"
                type="text"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                placeholder="e.g., Contract, Affidavit, etc."
                className="w-full bg-black/20 text-white border-purple-500/30 rounded-lg placeholder:text-gray-500"
              />
            </div>
            <div>
                <label htmlFor="parties" className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-1.5">
                    <Users className="w-4 h-4" />
                    Parties Involved (Optional)
                </label>
                <Input
                    id="parties"
                    type="text"
                    value={parties.join(', ')}
                    onChange={(e) => setParties(e.target.value.split(',').map(p => p.trim()).filter(p => p !== ''))}
                    placeholder="e.g., John Doe, Jane Smith"
                    className="w-full bg-black/20 text-white border-purple-500/30 rounded-lg placeholder:text-gray-500"
                />
            </div>
          </div>

          <Button
            onClick={handleNotarize}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-purple-500 to-blue-500 text-white font-semibold py-3 rounded-full hover:from-purple-600 hover:to-blue-600 transition-colors duration-300 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <KeyRound className="w-5 h-5" />
                Notarize Document
              </>
            )}
          </Button>

          {validationResult && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                'p-4 rounded-lg border',
                validationResult.isValid
                  ? 'bg-green-500/10 border-green-500/30 text-green-400'
                  : 'bg-red-500/10 border-red-500/30 text-red-400'
              )}
            >
              <div className="flex items-center gap-2">
                {validationResult.isValid ? (
                  <CheckCircle className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
                <h3 className="font-semibold">
                  {validationResult.isValid ? 'Validation Successful' : 'Validation Failed'}
                </h3>
              </div>
              <p className="mt-2 text-sm">{validationResult.report}</p>
            </motion.div>
          )}

          {nftId && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 }}
              className="bg-blue-500/10 border border-blue-500/30 p-4 rounded-lg text-blue-300 flex items-center gap-2"
            >
              <ShieldCheck className="w-5 h-5" />
              <p className="text-sm">
                Successfully Notarized! Your NFT ID is:
                <span className="font-semibold text-blue-200 ml-1">{nftId}</span>
              </p>
            </motion.div>
          )}

            {error && (
                <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-500/10 border border-red-500/30 p-4 rounded-lg text-red-400"
                >
                <AlertTriangle className="w-5 h-5 mr-2" />
                <p className="text-sm">{error}</p>
                </motion.div>
            )}
            <Button
                onClick={resetForm}
                variant="outline"
                className="w-full bg-white/5 hover:bg-white/10 text-white border-gray-700 mt-4"
                >
                Reset Form
            </Button>
        </div>
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-white/10 space-y-6">
            <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <Languages className="w-6 h-6" />
                Key Platform Features
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>
                <span className="font-medium text-blue-400">Secure Document Notarization via NFTs:</span>
                &nbsp;  Unique, tamper-proof cryptographic seals for document authenticity and ownership.
                </li>
                <li>
                <span className="font-medium text-blue-400">Intelligent Identity Verification:</span>
                &nbsp; Robust AI-powered checks to ensure only authorized users can notarize.
                </li>
                <li>
                <span className="font-medium text-blue-400">Advanced Document Validation:</span>
                &nbsp;  Multi-faceted AI analysis for text, signatures, watermarks, and context.
                </li>
                 <li>
                    <span className="font-medium text-blue-400">Secure Data Transmission:</span>
                    &nbsp; End-to-end encryption for all data between blockchain and AI services.
                </li>
                <li>
                <span className="font-medium text-blue-400">Transparent Event Logging:</span>
                &nbsp;  Clear, auditable records of all notarization activity on the blockchain.
                </li>
                <li>
                <span className="font-medium text-blue-400">Intuitive User Experience:</span>
                    &nbsp;  User-friendly interface for seamless notarization on web and mobile.
                </li>
                <li>
                <span className="font-medium text-blue-400">Simplified Onboarding:</span>
                    &nbsp;  Easy account setup with helpful resources.
                </li>
                <li>
                <span className="font-medium text-blue-400">Multi-Language Support:</span>
                    &nbsp;  Platform accessibility for a global audience.
                </li>
                <li>
                  <span className="font-medium text-blue-400">Integration with Existing Platforms:</span>
                  &nbsp; Compatibility with document management and e-signature tools.
                </li>
                <li>
                  <span className="font-medium text-blue-400">Clear and Competitive Pricing:</span>
                  &nbsp; Transparent cost structure.
                </li>
                <li>
                    <span className="font-medium text-blue-400">Jurisdictional Awareness:</span>
                    &nbsp; Adherence to legal requirements, with ongoing expansion.
                </li>
            </ul>
        </div>
        <div className="bg-white/5 backdrop-blur-lg rounded-xl shadow-2xl p-4 sm:p-6 md:p-8 border border-white/10 space-y-6">
             <h2 className="text-2xl font-semibold text-white flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                Use Cases
            </h2>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
                <li>
                <span className="font-medium text-blue-400">Legal and Business Contracts:</span>
                    &nbsp;  Secure notarization for agreements, ensuring validity.
                </li>
                <li>
                <span className="font-medium text-blue-400">Real Estate Transactions:</span>
                    &nbsp;  Digital notarization for deeds, mortgages, and property documents.
                </li>
                <li>
                <span className="font-medium text-blue-400">Intellectual Property Protection:</span>
                  &nbsp; Proof of ownership for patents, copyrights, and trademarks.
                </li>
                <li>
                <span className="font-medium text-blue-400">Financial Documents:</span>
                  &nbsp;  Secure notarization for loans and financial agreements.
                </li>
                <li>
                <span className="font-medium text-blue-400">Government and Regulatory Filings:</span>
                  &nbsp;  Facilitating secure submissions.
                </li>
                <li>
                <span className="font-medium text-blue-400">Healthcare Records:</span>
                  &nbsp; Ensuring the integrity of medical documents.
                </li>
                <li>
                <span className="font-medium text-blue-400">Educational Credentials:</span>
                    &nbsp; Verification of diplomas and certifications.
                </li>
            </ul>
        </div>
      </div>
    </div>
  );
};

export default AIAutonomousNotary;
