// Case States - must match overlay state model
export type CaseState =
  | 'DRAFT'
  | 'INTAKE_COMPLETE'
  | 'AI_ANALYZED'
  | 'IDENTITY_PENDING'
  | 'IDENTITY_COMPLETE'
  | 'POLICY_BLOCKED'
  | 'REVIEW_PENDING'
  | 'REVIEW_COMPLETE'
  | 'CEREMONY_PENDING'
  | 'CEREMONY_COMPLETE'
  | 'FINALIZED_OFFCHAIN'
  | 'REFUSED'
  | 'PUBLICATION_PENDING'
  | 'PUBLISHED'
  | 'PUBLICATION_FAILED'
  // NFT assetization states (downstream of finalization)
  | 'NFT_PREPARING'
  | 'NFT_MINTED'
  | 'NFT_FAILED';

// ─────────────────────────────────────────────────────────────────────────────
// NFT Collection Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mint lifecycle states for a notarized document collection.
 * These are DOWNSTREAM of off-chain legal finalization.
 * A mint failure does NOT invalidate the legal record.
 */
export type MintStatus =
  | 'NOT_STARTED'
  | 'PREPARING'
  | 'MINTING'
  | 'MINTED'
  | 'FAILED';

/** Visual seed used to deterministically generate collection artwork (Living Cipher). */
export interface ArtSeed {
  masterSeed: string;   // hex string — derived from collectionId + sessionId + rootHash
  collectionSeed: string; // hex string — shared across all child page NFTs
}

/** Master NotaryNFT asset — root legal/economic/collectible token for a session. */
export interface MasterNFTAsset {
  tokenId: string;
  sessionId: string;
  collectionId: string;
  documentSetRootHash: string;
  manifestHash: string;
  manifestCID?: string;
  artSeed: string;          // hex — drives the "Living Cipher" master artwork
  mintedAt: string;         // ISO timestamp
  mintStatus: MintStatus;
  fractionalizationEligible: true;  // Always true for master tokens
  metadataURI?: string;
  verificationURL?: string;
}

/** Child DocumentPageNFT — provenance / collectible sub-asset for one page or unit. */
export interface PageNFTAsset {
  tokenId: string;
  sessionId: string;
  collectionId: string;
  masterTokenId: string;
  pageIndex: number;        // 0-based
  pageCount: number;
  pageHash: string;
  artSeed: string;          // hex — derived from collectionId + pageIndex + pageHash
  mintedAt: string;
  metadataURI?: string;
  fractionalizationEligible: false; // Always false for page tokens
}

/** Collection manifest — ties master + page NFTs together with session identity. */
export interface NFTCollection {
  collectionIndex: number;
  collectionId: string;
  sessionId: string;
  caseId: string;           // Human-readable case identifier
  masterAsset: MasterNFTAsset | null;
  pageAssets: PageNFTAsset[];
  pageCount: number;
  documentSetRootHash: string;
  manifestHash: string;
  manifestCID?: string;
  artSeed: ArtSeed;
  recipient: string;
  registeredAt: string;
  mintStatus: MintStatus;
  mintedAt?: string;
  fractionalizationEligible: boolean;
  publicationStatus?: 'none' | 'published' | 'failed';
  publicationTxHash?: string;
}

// User Roles
export type UserRole = 'signer' | 'notary' | 'compliance' | 'verifier';

// Authority Provider Types
export type AuthorityProvider = 'human_commissioned' | 'autonomous';

// Legal Mode
export type LegalMode = 'compliant' | 'experimental';

// Document Types
export type DocumentType = 'contract' | 'deed' | 'affidavit' | 'power_of_attorney' | 'will' | 'trust' | 'other';

// Act Types
export type ActType = 'notarization' | 'acknowledgment' | 'jurat' | 'oath' | 'affirmation';

// Jurisdiction
export type Jurisdiction = 'US' | 'CA' | 'UK' | 'EU' | 'AU' | 'other';

// Identity Proofing Status
export interface IdentityProofingStatus {
  state: 'pending' | 'in_progress' | 'completed' | 'failed';
  completedChecks: string[];
  verifiedAt?: string;
}

// AI Analysis Status
export interface AIAnalysisStatus {
  state: 'pending' | 'completed' | 'failed';
  analysisId?: string;
  reviewed: boolean;
  riskScore?: number;
  fraudSignals?: FraudSignal[];
}

// Fraud Signal
export interface FraudSignal {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
}

// Human Review Status
export interface HumanReviewStatus {
  state: 'pending' | 'in_progress' | 'completed' | 'refused';
  reviewId?: string;
  finalApproval?: boolean;
  finalRefusal?: boolean;
  decision?: 'approve' | 'refuse' | 'escalate';
}

// Ceremony Status
export interface CeremonyStatus {
  state: 'pending' | 'in_progress' | 'completed';
  confirmedAt?: string;
  ceremonyId?: string;
  artifactRef?: string;
}

// Signer
export interface Signer {
  signerId: string;
  fullName: string;
  email: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
}

// Document
export interface Document {
  documentId: string;
  documentHash: string;
  documentType: DocumentType;
  fileName: string;
  fileSize: number;
  mimeType: string;
  pageCount?: number;
  uploadedAt: string;
  ipfsCID?: string;
}

// Case Context
export interface Case {
  actId: string;
  documentId: string;
  documentHash: string;
  actType: ActType;
  documentType: DocumentType;
  jurisdiction: Jurisdiction;
  signer: Signer;
  signerLocation: string;
  authorityLocation: string;
  requestedAuthorityMode: AuthorityProvider;
  activeAuthorityProvider: AuthorityProvider;
  legalMode: LegalMode;
  identityProofingStatus: IdentityProofingStatus;
  aiAnalysisStatus: AIAnalysisStatus;
  humanReviewStatus: HumanReviewStatus;
  ceremonyStatus: CeremonyStatus;
  policyDecisionId?: string | null;
  evidenceBundleId?: string | null;
  timestamps: {
    createdAt: string;
    updatedAt?: string;
    finalizedAt?: string;
  };
}

// AI Analysis Result
export interface AIAnalysisResult {
  analysisId: string;
  riskScore: number;
  overallAssessment: 'clean' | 'needs_review' | 'high_risk';
  documentFindings: AIFinding[];
  identityFindings: AIFinding[];
  fraudSignals: FraudSignal[];
  confidence: number;
  analyzedAt: string;
}

// AI Finding
export interface AIFinding {
  category: string;
  finding: string;
  severity: 'info' | 'low' | 'medium' | 'high';
  details?: string;
}

// Policy Decision
export interface PolicyDecision {
  decisionId: string;
  allowed: boolean;
  blockReason?: string;
  requiredAuthorityMode: AuthorityProvider;
  requireHumanSupervision: boolean;
  requireHumanCeremony: boolean;
  requireHumanFinalSignoff: boolean;
  requiredFlowSteps: string[];
  requiredEvidenceArtifacts: string[];
  requiredIdentityChecks: string[];
  maxRiskScore: number;
  blockedFraudSignals: string[];
  warnings: string[];
  policyVersion: string;
}

// Human Review
export interface HumanReview {
  reviewId: string;
  reviewerId: string;
  reviewerName: string;
  decision: 'approve' | 'refuse' | 'escalate';
  finalApproval: boolean;
  finalRefusal: boolean;
  notes: string;
  reviewedAt: string;
}

// Ceremony Record
export interface CeremonyRecord {
  ceremonyId: string;
  providerType: AuthorityProvider;
  confirmedAt: string;
  artifactRef: string;
  acknowledgments: string[];
  recordingRef?: string;
}

// Authority Execution
export interface AuthorityExecution {
  executionId: string;
  providerType: AuthorityProvider;
  status: 'authorized' | 'refused' | 'pending';
  authorizationTime?: string;
  refusalTime?: string;
  refusalReason?: string;
  publicationStatus?: 'pending' | 'published' | 'failed' | 'disabled';
  publicationTxHash?: string;
  publicationTime?: string;
}

// Evidence Bundle
export interface EvidenceBundle {
  bundleId: string;
  caseId: string;
  createdAt: string;
  manifest: EvidenceManifest;
  artifacts: EvidenceArtifact[];
}

// Evidence Manifest
export interface EvidenceManifest {
  version: string;
  caseId: string;
  bundleId: string;
  createdAt: string;
  artifactCount: number;
  contentHash: string;
}

// Evidence Artifact
export interface EvidenceArtifact {
  artifactId: string;
  artifactType: string;
  fileName: string;
  contentType: string;
  size: number;
  hash: string;
  createdAt: string;
  createdBy: string;
}

// Event
export interface CaseEvent {
  eventId: string;
  eventType: string;
  actId: string;
  timestamp: string;
  actor: string;
  details: Record<string, unknown>;
}

// Notary
export interface Notary {
  notaryId: string;
  fullName: string;
  commissionNumber: string;
  commissionExpires: string;
  jurisdiction: Jurisdiction;
  status: 'active' | 'inactive' | 'suspended';
}

// Queue Item
export interface QueueItem {
  caseId: string;
  signerName: string;
  actType: ActType;
  jurisdiction: Jurisdiction;
  identityStatus: IdentityProofingStatus['state'];
  riskBand: 'low' | 'medium' | 'high';
  scheduledTime?: string;
  currentBlocker?: string;
  requiredAction: string;
}

// Verification Result
export interface VerificationResult {
  status: 'verified' | 'altered' | 'not_found' | 'refused';
  caseId?: string;
  documentHash?: string;
  authorityMode?: AuthorityProvider;
  notarizationTime?: string;
  jurisdiction?: Jurisdiction;
  legalStatus: 'finalized_offchain' | 'finalized_and_published' | 'publication_failed' | 'refused';
  bundleStatus?: string;
  publicationStatus?: string;
}
