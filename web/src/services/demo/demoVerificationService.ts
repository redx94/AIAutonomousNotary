import type { VerificationResult } from '../../types';
import { mockCases, mockAuthorityExecutions } from '../../data/mockCases';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function buildResult(c: typeof mockCases[0]): VerificationResult {
  if (c.humanReviewStatus.state === 'refused') {
    return {
      status: 'refused',
      caseId: c.actId,
      legalStatus: 'refused',
      authorityMode: c.activeAuthorityProvider,
    };
  }
  if (!c.timestamps.finalizedAt) {
    return { status: 'not_found', caseId: c.actId, legalStatus: 'refused' };
  }
  const seg = c.actId.split('-')[2] ?? '';
  const exec = Object.values(mockAuthorityExecutions).find(e =>
    e.executionId.includes(seg)
  );
  const pubStatus = exec?.publicationStatus ?? 'pending';
  return {
    status: 'verified',
    caseId: c.actId,
    documentHash: c.documentHash,
    authorityMode: c.activeAuthorityProvider,
    notarizationTime: c.timestamps.finalizedAt,
    jurisdiction: c.jurisdiction,
    legalStatus:
      pubStatus === 'published' ? 'finalized_and_published' :
      pubStatus === 'failed' ? 'publication_failed' :
      'finalized_offchain',
    publicationStatus: pubStatus,
    bundleStatus: c.evidenceBundleId ? 'available' : 'unavailable',
  };
}

export async function verifyByHash(hash: string): Promise<VerificationResult> {
  await delay(800);
  const found = mockCases.find(c => c.documentHash.startsWith(hash.slice(0, 8)));
  if (!found) return { status: 'not_found', legalStatus: 'refused' };
  return buildResult(found);
}

export async function verifyByCaseId(caseId: string): Promise<VerificationResult> {
  await delay(600);
  const found = mockCases.find(c => c.actId === caseId);
  if (!found) return { status: 'not_found', legalStatus: 'refused' };
  return buildResult(found);
}
