import type { Case, AIAnalysisResult, PolicyDecision, HumanReview, CeremonyRecord, AuthorityExecution, EvidenceBundle, CaseEvent } from '../types';

export const mockSigner = {
  signerId: 'signer-001',
  fullName: 'Sarah Johnson',
  email: 'sarah.johnson@example.com',
  phone: '+1-555-0123',
  address: '123 Main St, Boston, MA 02101',
  dateOfBirth: '1985-03-15',
};

export const mockDocument = {
  documentId: 'doc-001',
  documentHash: '0x7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa5d0...',
  documentType: 'contract' as const,
  fileName: 'Service_Agreement_2024.pdf',
  fileSize: 2457600,
  mimeType: 'application/pdf',
  pageCount: 5,
  uploadedAt: '2026-04-01T14:30:00Z',
  ipfsCID: 'QmX4z...7dK2',
};

export const mockCases: Case[] = [
  // Case 1: Draft state
  {
    actId: 'act-draft-001',
    documentId: 'doc-draft-001',
    documentHash: '0xabc123...',
    actType: 'notarization',
    documentType: 'contract',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-draft', fullName: 'John Doe', email: 'john@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'pending', completedChecks: [] },
    aiAnalysisStatus: { state: 'pending', reviewed: false },
    humanReviewStatus: { state: 'pending' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { createdAt: '2026-04-02T10:00:00Z' },
  },
  
  // Case 2: Identity pending
  {
    actId: 'act-id-002',
    documentId: 'doc-id-002',
    documentHash: '0xdef456...',
    actType: 'acknowledgment',
    documentType: 'deed',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-id', fullName: 'Emily Chen', email: 'emily@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'in_progress', completedChecks: ['identity_verified'] },
    aiAnalysisStatus: { state: 'completed', reviewed: false, riskScore: 25, analysisId: 'ai-002' },
    humanReviewStatus: { state: 'pending' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { createdAt: '2026-04-02T09:00:00Z' },
  },
  
  // Case 3: Review pending (high risk)
  {
    actId: 'act-review-003',
    documentId: 'doc-review-003',
    documentHash: '0xghi789...',
    actType: 'notarization',
    documentType: 'power_of_attorney',
    jurisdiction: 'US',
    signer: mockSigner,
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-04-01T15:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: false, riskScore: 75, analysisId: 'ai-003', fraudSignals: [{ type: 'anomaly_detected', severity: 'high', description: 'Unusual document formatting detected' }] },
    humanReviewStatus: { state: 'in_progress' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { createdAt: '2026-04-01T14:30:00Z' },
  },
  
  // Case 4: Ceremony pending
  {
    actId: 'act-ceremony-004',
    documentId: 'doc-ceremony-004',
    documentHash: '0xjkl012...',
    actType: 'jurat',
    documentType: 'affidavit',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-ceremony', fullName: 'Michael Brown', email: 'michael@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-04-01T13:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: true, riskScore: 15, analysisId: 'ai-004' },
    humanReviewStatus: { state: 'completed', reviewId: 'review-004', finalApproval: true, decision: 'approve' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { createdAt: '2026-04-01T12:00:00Z' },
  },
  
  // Case 5: Finalized offchain (publication pending)
  {
    actId: 'act-final-005',
    documentId: 'doc-final-005',
    documentHash: '0xmno345...',
    actType: 'notarization',
    documentType: 'contract',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-final', fullName: 'Alice Williams', email: 'alice@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-04-01T11:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: true, riskScore: 20, analysisId: 'ai-005' },
    humanReviewStatus: { state: 'completed', reviewId: 'review-005', finalApproval: true, decision: 'approve' },
    ceremonyStatus: { state: 'completed', confirmedAt: '2026-04-01T12:30:00Z', ceremonyId: 'ceremony-005', artifactRef: 'artifact-005' },
    policyDecisionId: 'policy-005',
    evidenceBundleId: 'bundle-005',
    timestamps: { 
      createdAt: '2026-04-01T10:00:00Z',
      finalizedAt: '2026-04-01T12:45:00Z'
    },
  },
  
  // Case 6: Published
  {
    actId: 'act-published-006',
    documentId: 'doc-published-006',
    documentHash: '0xpqr678...',
    actType: 'oath',
    documentType: 'affidavit',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-pub', fullName: 'Robert Davis', email: 'robert@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-03-31T15:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: true, riskScore: 10, analysisId: 'ai-006' },
    humanReviewStatus: { state: 'completed', reviewId: 'review-006', finalApproval: true, decision: 'approve' },
    ceremonyStatus: { state: 'completed', confirmedAt: '2026-03-31T16:30:00Z', ceremonyId: 'ceremony-006', artifactRef: 'artifact-006' },
    policyDecisionId: 'policy-006',
    evidenceBundleId: 'bundle-006',
    timestamps: { 
      createdAt: '2026-03-31T14:00:00Z',
      finalizedAt: '2026-03-31T16:45:00Z'
    },
  },
  
  // Case 7: Refused
  {
    actId: 'act-refused-007',
    documentId: 'doc-refused-007',
    documentHash: '0xstu901...',
    actType: 'notarization',
    documentType: 'will',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-ref', fullName: 'Thomas Wilson', email: 'thomas@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified'], verifiedAt: '2026-03-30T10:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: true, riskScore: 80, analysisId: 'ai-007', fraudSignals: [{ type: 'identity_mismatch', severity: 'critical', description: 'Identity documents do not match signer' }] },
    humanReviewStatus: { state: 'refused', reviewId: 'review-007', finalRefusal: true as any, decision: 'refuse' },
    ceremonyStatus: { state: 'pending' },
    timestamps: { 
      createdAt: '2026-03-30T09:00:00Z',
    },
  },
  
  // Case 8: Publication failed (but finalized)
  {
    actId: 'act-pubfail-008',
    documentId: 'doc-pubfail-008',
    documentHash: '0xvwx234...',
    actType: 'acknowledgment',
    documentType: 'trust',
    jurisdiction: 'US',
    signer: { ...mockSigner, signerId: 'signer-pf', fullName: 'Jennifer Lee', email: 'jennifer@example.com' },
    signerLocation: 'US',
    authorityLocation: 'US',
    requestedAuthorityMode: 'human_commissioned',
    activeAuthorityProvider: 'human_commissioned',
    legalMode: 'compliant',
    identityProofingStatus: { state: 'completed', completedChecks: ['identity_verified', 'credential_screened'], verifiedAt: '2026-03-29T11:00:00Z' },
    aiAnalysisStatus: { state: 'completed', reviewed: true, riskScore: 30, analysisId: 'ai-008' },
    humanReviewStatus: { state: 'completed', reviewId: 'review-008', finalApproval: true, decision: 'approve' },
    ceremonyStatus: { state: 'completed', confirmedAt: '2026-03-29T13:00:00Z', ceremonyId: 'ceremony-008', artifactRef: 'artifact-008' },
    policyDecisionId: 'policy-008',
    evidenceBundleId: 'bundle-008',
    timestamps: { 
      createdAt: '2026-03-29T10:00:00Z',
      finalizedAt: '2026-03-29T13:15:00Z'
    },
  },
];

export const mockAIAnalysis: Record<string, AIAnalysisResult> = {
  'ai-003': {
    analysisId: 'ai-003',
    riskScore: 75,
    overallAssessment: 'high_risk',
    documentFindings: [
      { category: 'formatting', finding: 'Unusual document formatting', severity: 'high', details: 'Document contains formatting inconsistent with standard templates' },
      { category: 'content', finding: 'Multiple signature blocks detected', severity: 'medium' },
    ],
    identityFindings: [
      { category: 'document', finding: 'ID document appears valid', severity: 'info' },
    ],
    fraudSignals: [
      { type: 'anomaly_detected', severity: 'high', description: 'Unusual document formatting detected' },
    ],
    confidence: 0.82,
    analyzedAt: '2026-04-01T14:35:00Z',
  },
  'ai-004': {
    analysisId: 'ai-004',
    riskScore: 15,
    overallAssessment: 'clean',
    documentFindings: [
      { category: 'formatting', finding: 'Document format standard', severity: 'info' },
      { category: 'content', finding: 'All required elements present', severity: 'info' },
    ],
    identityFindings: [
      { category: 'document', finding: 'ID verification successful', severity: 'info' },
      { category: 'liveness', finding: 'Liveness check passed', severity: 'info' },
    ],
    fraudSignals: [],
    confidence: 0.96,
    analyzedAt: '2026-04-01T12:05:00Z',
  },
  'ai-005': {
    analysisId: 'ai-005',
    riskScore: 20,
    overallAssessment: 'clean',
    documentFindings: [
      { category: 'formatting', finding: 'Standard contract format', severity: 'info' },
    ],
    identityFindings: [
      { category: 'document', finding: 'Identity verified', severity: 'info' },
    ],
    fraudSignals: [],
    confidence: 0.94,
    analyzedAt: '2026-04-01T10:15:00Z',
  },
};

export const mockPolicyDecisions: Record<string, PolicyDecision> = {
  'policy-005': {
    decisionId: 'policy-005',
    allowed: true,
    requiredAuthorityMode: 'human_commissioned',
    requireHumanSupervision: true,
    requireHumanCeremony: true,
    requireHumanFinalSignoff: true,
    requiredFlowSteps: ['signer_intake', 'document_intake', 'ai_analysis', 'identity_proofing', 'policy_evaluation', 'human_review', 'ceremony', 'finalization'],
    requiredEvidenceArtifacts: ['manifest.json', 'policy-decision.json', 'ai-analysis.json', 'human-review.json', 'ceremony-record.json'],
    requiredIdentityChecks: ['identity_verified', 'credential_screened'],
    maxRiskScore: 70,
    blockedFraudSignals: ['document_tamper_detected', 'identity_mismatch'],
    warnings: ['AI output remains advisory-only in compliant mode', 'Protocol publication is downstream and non-authoritative'],
    policyVersion: 'overlay-v2-2026-04-01',
  },
};

export const mockHumanReviews: Record<string, HumanReview> = {
  'review-005': {
    reviewId: 'review-005',
    reviewerId: 'notary-001',
    reviewerName: 'Jane Smith, Notary Public',
    decision: 'approve',
    finalApproval: true,
    finalRefusal: false,
    notes: 'Document and identity verified. Signer appeared competent and willing. AI anomalies explained as template variation.',
    reviewedAt: '2026-04-01T12:15:00Z',
  },
  'review-007': {
    reviewId: 'review-007',
    reviewerId: 'notary-002',
    reviewerName: 'David Johnson, Notary Public',
    decision: 'refuse',
    finalApproval: false,
    finalRefusal: true,
    notes: 'Identity documents do not match signer appearance. Cannot proceed with notarization.',
    reviewedAt: '2026-03-30T10:30:00Z',
  },
};

export const mockCeremonyRecords: Record<string, CeremonyRecord> = {
  'ceremony-005': {
    ceremonyId: 'ceremony-005',
    providerType: 'human_commissioned',
    confirmedAt: '2026-04-01T12:30:00Z',
    artifactRef: 'ceremony-artifact-005',
    acknowledgments: [
      'Signer confirmed identity',
      'Signer acknowledged document contents',
      'Signer declared willingness to sign',
      'Signer confirmed signature was made freely',
    ],
    recordingRef: 'recording-005',
  },
};

export const mockAuthorityExecutions: Record<string, AuthorityExecution> = {
  'exec-005': {
    executionId: 'exec-005',
    providerType: 'human_commissioned',
    status: 'authorized',
    authorizationTime: '2026-04-01T12:45:00Z',
    publicationStatus: 'pending',
  },
  'exec-006': {
    executionId: 'exec-006',
    providerType: 'human_commissioned',
    status: 'authorized',
    authorizationTime: '2026-03-31T16:45:00Z',
    publicationStatus: 'published',
    publicationTxHash: '0xabc123def456...',
    publicationTime: '2026-03-31T16:50:00Z',
  },
  'exec-008': {
    executionId: 'exec-008',
    providerType: 'human_commissioned',
    status: 'authorized',
    authorizationTime: '2026-03-29T13:15:00Z',
    publicationStatus: 'failed',
  },
};

export const mockEvidenceBundles: Record<string, EvidenceBundle> = {
  'bundle-005': {
    bundleId: 'bundle-005',
    caseId: 'act-final-005',
    createdAt: '2026-04-01T12:45:00Z',
    manifest: {
      version: '1.0',
      caseId: 'act-final-005',
      bundleId: 'bundle-005',
      createdAt: '2026-04-01T12:45:00Z',
      artifactCount: 9,
      contentHash: 'sha256:8f7d3a...',
    },
    artifacts: [
      { artifactId: 'art-001', artifactType: 'manifest', fileName: 'manifest.json', contentType: 'application/json', size: 1024, hash: 'sha256:...', createdAt: '2026-04-01T12:45:00Z', createdBy: 'system' },
      { artifactId: 'art-002', artifactType: 'policy-decision', fileName: 'policy-decision.json', contentType: 'application/json', size: 2048, hash: 'sha256:...', createdAt: '2026-04-01T12:45:00Z', createdBy: 'policy-engine' },
      { artifactId: 'art-003', artifactType: 'ai-analysis', fileName: 'ai-analysis.json', contentType: 'application/json', size: 5120, hash: 'sha256:...', createdAt: '2026-04-01T10:20:00Z', createdBy: 'ai-service' },
    ],
  },
};

export const mockEvents: CaseEvent[] = [
  { eventId: 'evt-001', eventType: 'SIGNER_INTAKE_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T10:00:00Z', actor: 'signer', details: {} },
  { eventId: 'evt-002', eventType: 'DOCUMENT_INTAKE_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T10:05:00Z', actor: 'system', details: { documentId: 'doc-final-005' } },
  { eventId: 'evt-003', eventType: 'AI_ANALYSIS_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T10:15:00Z', actor: 'ai-service', details: { analysisId: 'ai-005', riskScore: 20 } },
  { eventId: 'evt-004', eventType: 'IDENTITY_VERIFICATION_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T11:00:00Z', actor: 'identity-service', details: { checks: ['identity_verified', 'credential_screened'] } },
  { eventId: 'evt-005', eventType: 'POLICY_DECISION_ISSUED', actId: 'act-final-005', timestamp: '2026-04-01T11:05:00Z', actor: 'policy-engine', details: { decisionId: 'policy-005', allowed: true } },
  { eventId: 'evt-006', eventType: 'HUMAN_REVIEW_OPENED', actId: 'act-final-005', timestamp: '2026-04-01T11:10:00Z', actor: 'notary-001', details: {} },
  { eventId: 'evt-007', eventType: 'HUMAN_REVIEW_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T12:15:00Z', actor: 'notary-001', details: { reviewId: 'review-005', decision: 'approve' } },
  { eventId: 'evt-008', eventType: 'CEREMONY_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T12:30:00Z', actor: 'notary-001', details: { ceremonyId: 'ceremony-005' } },
  { eventId: 'evt-009', eventType: 'ACT_AUTHORIZED', actId: 'act-final-005', timestamp: '2026-04-01T12:45:00Z', actor: 'notary-001', details: { executionId: 'exec-005' } },
  { eventId: 'evt-010', eventType: 'CERTIFICATE_COMPLETED', actId: 'act-final-005', timestamp: '2026-04-01T12:45:00Z', actor: 'system', details: {} },
  { eventId: 'evt-011', eventType: 'FINAL_RECORD_SIGNED', actId: 'act-final-005', timestamp: '2026-04-01T12:45:00Z', actor: 'system', details: {} },
  { eventId: 'evt-012', eventType: 'EVIDENCE_BUNDLE_CREATED', actId: 'act-final-005', timestamp: '2026-04-01T12:45:00Z', actor: 'system', details: { bundleId: 'bundle-005' } },
  { eventId: 'evt-013', eventType: 'PROTOCOL_PUBLICATION_ATTEMPTED', actId: 'act-final-005', timestamp: '2026-04-01T12:50:00Z', actor: 'system', details: {} },
];
