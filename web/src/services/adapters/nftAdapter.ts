/**
 * Integration-ready adapter for NFT collection operations.
 * Delegates to demo implementations today; swap for live contract/API
 * implementations when the on-chain layer is deployed.
 *
 * Screens must import from this adapter — never from the demo service directly.
 */
import type { NFTCollection, MasterNFTAsset, PageNFTAsset, MintStatus } from '../../types';
import * as demo from '../demo/demoNFTService';

export function getNFTCollection(caseId: string): Promise<NFTCollection | undefined> {
  return demo.getNFTCollection(caseId);
}

export function getMasterAsset(caseId: string): Promise<MasterNFTAsset | null> {
  return demo.getMasterAsset(caseId);
}

export function getPageAssets(caseId: string): Promise<PageNFTAsset[]> {
  return demo.getPageAssets(caseId);
}

export function getMintStatus(caseId: string): Promise<MintStatus> {
  return demo.getMintStatus(caseId);
}

export function listCollections(): Promise<NFTCollection[]> {
  return demo.listCollections();
}
