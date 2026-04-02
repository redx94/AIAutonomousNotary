import type {
  Case, AIAnalysisResult, PolicyDecision,
  HumanReview, CeremonyRecord, AuthorityExecution,
  EvidenceBundle, CaseEvent, QueueItem,
} from '../../types';
import {
  mockCases, mockAIAnalysis, mockPolicyDecisions,
  mockHumanReviews, mockCeremonyRecords, mockAuthorityExecutions,
  mockEvidenceBundles, mockEvents,
} from '../../data/mockCases';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export async function getCases(): Promise<Case[]> {
  await delay(300);
  return mockCases;
}

export async function getCase(actId: string): Promise<Case | undefined> {
  await delay(200);
  return mockCases.find(c => c.actId === actId);
}

export async function getAIAnalysis(analysisId: string): Promise<AIAnalysisResult | undefined> {
  await delay(250);
  return mockAIAnalysis[analysisId];
}

export async function getPolicyDecision(decisionId: string): Promise<PolicyDecision | undefined> {
  await delay(150);
  return mockPolicyDecisions[decisionId];
}

export async function getHumanReview(reviewId: string): Promise<HumanReview | undefined> {
  await delay(150);
  return mockHumanReviews[reviewId];
}

export async function getCeremonyRecord(ceremonyId: string): Promise<CeremonyRecord | undefined> {
  await delay(150);
  return mockCeremonyRecords[ceremonyId];
}

export async function getAuthorityExecution(executionId: string): Promise<AuthorityExecution | undefined> {
  await delay(150);
  return mockAuthorityExecutions[executionId];
}

export async function getEvidenceBundle(bundleId: string): Promise<EvidenceBundle | undefined> {
  await delay(200);
  return mockEvidenceBundles[bundleId];
}

export async function getCaseEvents(actId: string): Promise<CaseEvent[]> {
  await delay(250);
  return mockEvents.filter(e => e.actId === actId);
}

export async function getQueue(): Promise<QueueItem[]> {
  await delay(300);
  return mockCases
    .filter(c =>
      c.aiAnalysisStatus.state === 'completed' &&
      (c.humanReviewStatus.state === 'pending' || c.humanReviewStatus.state === 'in_progress')
    )
    .map(c => ({
      caseId: c.actId,
      signerName: c.signer.fullName,
      actType: c.actType,
      jurisdiction: c.jurisdiction,
      identityStatus: c.identityProofingStatus.state,
      riskBand:
        (c.aiAnalysisStatus.riskScore || 0) > 70 ? ('high' as const) :
        (c.aiAnalysisStatus.riskScore || 0) > 30 ? ('medium' as const) :
        ('low' as const),
      currentBlocker:
        c.humanReviewStatus.state === 'in_progress' ? 'Awaiting review completion' :
        c.identityProofingStatus.state !== 'completed' ? 'Identity pending' :
        undefined,
      requiredAction:
        c.humanReviewStatus.state === 'in_progress' ? 'Complete review' : 'Begin review',
    }));
}

export async function submitReviewDecision(
  _caseId: string,
  _decision: 'approve' | 'refuse',
  _notes: string,
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  await delay(600);
  return { success: true, reviewId: `review-demo-${Date.now()}` };
}
