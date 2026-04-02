import type { 
  Case, CaseState, AIAnalysisResult, PolicyDecision, 
  HumanReview, CeremonyRecord, AuthorityExecution, 
  EvidenceBundle, CaseEvent, QueueItem 
} from '../types';
import { 
  mockCases, mockAIAnalysis, mockPolicyDecisions, 
  mockHumanReviews, mockCeremonyRecords, mockAuthorityExecutions,
  mockEvidenceBundles, mockEvents 
} from '../data/mockCases';

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export class CaseService {
  // Get all cases
  static async getCases(): Promise<Case[]> {
    await delay(300);
    return mockCases;
  }
  
  // Get case by ID
  static async getCase(actId: string): Promise<Case | undefined> {
    await delay(200);
    return mockCases.find(c => c.actId === actId);
  }
  
  // Get case state label
  static getStateLabel(state: CaseState): string {
    const labels: Record<CaseState, string> = {
      'DRAFT': 'Draft',
      'INTAKE_COMPLETE': 'Intake Complete',
      'AI_ANALYZED': 'AI Analysis Complete',
      'IDENTITY_PENDING': 'Identity Verification Pending',
      'IDENTITY_COMPLETE': 'Identity Verified',
      'POLICY_BLOCKED': 'Blocked by Policy',
      'REVIEW_PENDING': 'Awaiting Review',
      'REVIEW_COMPLETE': 'Review Complete',
      'CEREMONY_PENDING': 'Session Pending',
      'CEREMONY_COMPLETE': 'Session Complete',
      'FINALIZED_OFFCHAIN': 'Finalized (Legal)',
      'REFUSED': 'Refused',
      'PUBLICATION_PENDING': 'Publishing to Protocol',
      'PUBLISHED': 'Published',
      'PUBLICATION_FAILED': 'Publication Failed',
    };
    return labels[state] || state;
  }
  
  // Get next action for a case
  static getNextAction(caseData: Case): { label: string; path: string; enabled: boolean } {
    const state = caseData.humanReviewStatus.state === 'refused' ? 'REFUSED' :
                  caseData.ceremonyStatus.state === 'completed' && !caseData.timestamps.finalizedAt ? 'FINALIZED_OFFCHAIN' :
                  caseData.humanReviewStatus.state === 'completed' && caseData.humanReviewStatus.finalApproval ? 'CEREMONY_PENDING' :
                  caseData.humanReviewStatus.state === 'in_progress' ? 'REVIEW_PENDING' :
                  caseData.identityProofingStatus.state !== 'completed' ? 'IDENTITY_PENDING' :
                  caseData.aiAnalysisStatus.state === 'completed' ? 'REVIEW_PENDING' :
                  caseData.documentId ? 'AI_ANALYZED' : 'DRAFT';
    
    const actions: Record<string, { label: string; path: string; enabled: boolean }> = {
      'DRAFT': { label: 'Upload Document', path: '/signer/upload', enabled: true },
      'IDENTITY_PENDING': { label: 'Complete Identity Check', path: '/signer/identity', enabled: true },
      'REVIEW_PENDING': { label: 'View Status', path: '/signer/case', enabled: true },
      'CEREMONY_PENDING': { label: 'Join Session', path: '/signer/session', enabled: true },
      'FINALIZED_OFFCHAIN': { label: 'View Certificate', path: '/signer/final', enabled: true },
      'REFUSED': { label: 'View Details', path: '/signer/case', enabled: true },
    };
    
    return actions[state] || { label: 'View Case', path: '/signer/case', enabled: true };
  }
  
  // Get AI analysis for case
  static async getAIAnalysis(analysisId: string): Promise<AIAnalysisResult | undefined> {
    await delay(250);
    return mockAIAnalysis[analysisId];
  }
  
  // Get policy decision
  static async getPolicyDecision(decisionId: string): Promise<PolicyDecision | undefined> {
    await delay(150);
    return mockPolicyDecisions[decisionId];
  }
  
  // Get human review
  static async getHumanReview(reviewId: string): Promise<HumanReview | undefined> {
    await delay(150);
    return mockHumanReviews[reviewId];
  }
  
  // Get ceremony record
  static async getCeremonyRecord(ceremonyId: string): Promise<CeremonyRecord | undefined> {
    await delay(150);
    return mockCeremonyRecords[ceremonyId];
  }
  
  // Get authority execution
  static async getAuthorityExecution(executionId: string): Promise<AuthorityExecution | undefined> {
    await delay(150);
    return mockAuthorityExecutions[executionId];
  }
  
  // Get evidence bundle
  static async getEvidenceBundle(bundleId: string): Promise<EvidenceBundle | undefined> {
    await delay(200);
    return mockEvidenceBundles[bundleId];
  }
  
  // Get events for case
  static async getCaseEvents(actId: string): Promise<CaseEvent[]> {
    await delay(250);
    return mockEvents.filter(e => e.actId === actId);
  }
  
  // Get notary queue
  static async getQueue(): Promise<QueueItem[]> {
    await delay(300);
    return mockCases
      .filter(c => ['AI_ANALYZED', 'IDENTITY_COMPLETE', 'REVIEW_PENDING', 'CEREMONY_PENDING'].some(() => 
        c.aiAnalysisStatus.state === 'completed' && 
        (c.humanReviewStatus.state === 'pending' || c.humanReviewStatus.state === 'in_progress')
      ))
      .map(c => ({
        caseId: c.actId,
        signerName: c.signer.fullName,
        actType: c.actType,
        jurisdiction: c.jurisdiction,
        identityStatus: c.identityProofingStatus.state,
        riskBand: (c.aiAnalysisStatus.riskScore || 0) > 70 ? 'high' : (c.aiAnalysisStatus.riskScore || 0) > 30 ? 'medium' : 'low',
        currentBlocker: c.humanReviewStatus.state === 'in_progress' ? 'Awaiting review completion' : 
                       c.identityProofingStatus.state !== 'completed' ? 'Identity pending' : undefined,
        requiredAction: c.humanReviewStatus.state === 'in_progress' ? 'Complete review' : 'Begin review',
      }));
  }
  
  // Verify document
  static async verifyDocument(documentHash: string): Promise<{ 
    found: boolean; 
    case?: Case; 
    execution?: AuthorityExecution;
  }> {
    await delay(400);
    const caseData = mockCases.find(c => c.documentHash.includes(documentHash.slice(0, 20)));
    if (!caseData) {
      return { found: false };
    }
    const execution = Object.values(mockAuthorityExecutions).find(e => 
      caseData.actId.includes(e.executionId.split('-')[1])
    );
    return { found: true, case: caseData, execution };
  }
}
