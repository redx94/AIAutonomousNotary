// Integration-ready adapter for document verification.
// Delegates to demo implementations today; swap for overlay/API implementations later.
import type { VerificationResult } from '../../types';
import * as demo from '../demo/demoVerificationService';

export function verifyByHash(hash: string): Promise<VerificationResult> {
  return demo.verifyByHash(hash);
}

export function verifyByCaseId(caseId: string): Promise<VerificationResult> {
  return demo.verifyByCaseId(caseId);
}
