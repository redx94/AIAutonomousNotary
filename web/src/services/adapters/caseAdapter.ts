// Integration-ready adapter for case operations.
// Delegates to demo implementations today; swap for overlay/API implementations later.
import type {
  Case, AIAnalysisResult, PolicyDecision,
  HumanReview, CeremonyRecord, AuthorityExecution,
  EvidenceBundle, CaseEvent, QueueItem,
} from '../../types';
import * as demo from '../demo/demoCaseService';

export function getCases(): Promise<Case[]> {
  return demo.getCases();
}

export function getCase(actId: string): Promise<Case | undefined> {
  return demo.getCase(actId);
}

export function getAIAnalysis(analysisId: string): Promise<AIAnalysisResult | undefined> {
  return demo.getAIAnalysis(analysisId);
}

export function getPolicyDecision(decisionId: string): Promise<PolicyDecision | undefined> {
  return demo.getPolicyDecision(decisionId);
}

export function getHumanReview(reviewId: string): Promise<HumanReview | undefined> {
  return demo.getHumanReview(reviewId);
}

export function getCeremonyRecord(ceremonyId: string): Promise<CeremonyRecord | undefined> {
  return demo.getCeremonyRecord(ceremonyId);
}

export function getAuthorityExecution(executionId: string): Promise<AuthorityExecution | undefined> {
  return demo.getAuthorityExecution(executionId);
}

export function getEvidenceBundle(bundleId: string): Promise<EvidenceBundle | undefined> {
  return demo.getEvidenceBundle(bundleId);
}

export function getCaseEvents(actId: string): Promise<CaseEvent[]> {
  return demo.getCaseEvents(actId);
}

export function getQueue(): Promise<QueueItem[]> {
  return demo.getQueue();
}

export function submitReviewDecision(
  caseId: string,
  decision: 'approve' | 'refuse',
  notes: string,
): Promise<{ success: boolean; reviewId?: string; error?: string }> {
  return demo.submitReviewDecision(caseId, decision, notes);
}
