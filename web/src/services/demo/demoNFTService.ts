/**
 * Demo NFT service — integration-ready mock for the NFT collection layer.
 * Screens must import via nftAdapter.ts, never directly.
 */
import type { NFTCollection, MasterNFTAsset, PageNFTAsset, MintStatus } from '../../types';

const delay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MINTED_COLLECTION: NFTCollection = {
  collectionIndex: 1,
  collectionId: '0xc0llect10n1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
  sessionId: '0xsess10n001aabbccddeeff00112233445566778899',
  caseId: 'act-published-006',
  documentSetRootHash: '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
  manifestHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
  manifestCID: 'QmManifest7dK2xN3pQ9rV5sT8uW1xY4zA6bC9dE2fG5h',
  artSeed: {
    masterSeed: '0xdead1337beef0000cafebabe11223344556677889900aabb',
    collectionSeed: '0xcafe0000babe1111dead2222beef3333face4444feed5555',
  },
  pageCount: 3,
  masterAsset: {
    tokenId: '42',
    sessionId: '0xsess10n001aabbccddeeff00112233445566778899',
    collectionId: '0xc0llect10n1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
    documentSetRootHash: '0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b',
    manifestHash: '0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
    manifestCID: 'QmManifest7dK2xN3pQ9rV5sT8uW1xY4zA6bC9dE2fG5h',
    artSeed: '0xdead1337beef0000cafebabe11223344556677889900aabb',
    mintedAt: '2026-03-31T16:46:00Z',
    mintStatus: 'MINTED',
    fractionalizationEligible: true,
    metadataURI: 'ipfs://QmMasterMetadata001',
    verificationURL: 'https://ainotary.example.com/verify/act-published-006',
  },
  pageAssets: [
    {
      tokenId: '43',
      sessionId: '0xsess10n001aabbccddeeff00112233445566778899',
      collectionId: '0xc0llect10n1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
      masterTokenId: '42',
      pageIndex: 0,
      pageCount: 3,
      pageHash: '0xpage0hash1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f',
      artSeed: '0xpageseed0aabbccddeeff0011223344556677889900aabb',
      mintedAt: '2026-03-31T16:47:00Z',
      metadataURI: 'ipfs://QmPageMetadata001-page0',
      fractionalizationEligible: false,
    },
    {
      tokenId: '44',
      sessionId: '0xsess10n001aabbccddeeff00112233445566778899',
      collectionId: '0xc0llect10n1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
      masterTokenId: '42',
      pageIndex: 1,
      pageCount: 3,
      pageHash: '0xpage1hash2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a',
      artSeed: '0xpageseed1bbccddeeff00112233445566778899aabbccdd',
      mintedAt: '2026-03-31T16:47:05Z',
      metadataURI: 'ipfs://QmPageMetadata001-page1',
      fractionalizationEligible: false,
    },
    {
      tokenId: '45',
      sessionId: '0xsess10n001aabbccddeeff00112233445566778899',
      collectionId: '0xc0llect10n1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6',
      masterTokenId: '42',
      pageIndex: 2,
      pageCount: 3,
      pageHash: '0xpage2hash3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b',
      artSeed: '0xpageseed2ccddeeff001122334455667788990011aabbcc',
      mintedAt: '2026-03-31T16:47:10Z',
      metadataURI: 'ipfs://QmPageMetadata001-page2',
      fractionalizationEligible: false,
    },
  ],
  recipient: '0xSi9n3rAddr3ss0000000000000000000000000000',
  registeredAt: '2026-03-31T16:45:30Z',
  mintStatus: 'MINTED',
  mintedAt: '2026-03-31T16:47:15Z',
  fractionalizationEligible: true,
  publicationStatus: 'published',
  publicationTxHash: '0xabc...def',
};

const PREPARING_COLLECTION: NFTCollection = {
  collectionIndex: 2,
  collectionId: '0xc0llect10n2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d',
  sessionId: '0xsess10n002bbccddeeff0011223344556677889900',
  caseId: 'act-ceremony-004',
  documentSetRootHash: '0x9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c',
  manifestHash: '0x2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c',
  artSeed: {
    masterSeed: '0xfeed0001cafe0002babe0003dead0004beef0005face0006',
    collectionSeed: '0xface0007feed0008cafe0009babe000adead000bbeef000c',
  },
  pageCount: 2,
  masterAsset: null,
  pageAssets: [],
  recipient: '0xSi9n3rAddr3ss1111111111111111111111111111',
  registeredAt: '2026-04-01T09:30:00Z',
  mintStatus: 'PREPARING',
  fractionalizationEligible: true,
  publicationStatus: 'none',
};

const mockCollections: Record<string, NFTCollection> = {
  'act-published-006': MINTED_COLLECTION,
  'act-ceremony-004': PREPARING_COLLECTION,
};

// ─────────────────────────────────────────────────────────────────────────────
// Service functions
// ─────────────────────────────────────────────────────────────────────────────

export async function getNFTCollection(caseId: string): Promise<NFTCollection | undefined> {
  await delay(300);
  return mockCollections[caseId];
}

export async function getMasterAsset(caseId: string): Promise<MasterNFTAsset | null> {
  await delay(200);
  return mockCollections[caseId]?.masterAsset ?? null;
}

export async function getPageAssets(caseId: string): Promise<PageNFTAsset[]> {
  await delay(200);
  return mockCollections[caseId]?.pageAssets ?? [];
}

export async function getMintStatus(caseId: string): Promise<MintStatus> {
  await delay(150);
  return mockCollections[caseId]?.mintStatus ?? 'NOT_STARTED';
}

export async function listCollections(): Promise<NFTCollection[]> {
  await delay(400);
  return Object.values(mockCollections);
}
