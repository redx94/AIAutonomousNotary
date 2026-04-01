# AI Autonomous Notary — DID Interface Design

## Overview

This document defines how **W3C Decentralized Identifiers (DIDs)** and **Verifiable Credentials (VCs)** integrate with the AI Autonomous Notary Protocol's `DocumentRegistry` and `NotaryNFT` contracts, replacing raw `address`-based identity with a self-sovereign, portable identity layer.

---

## Problem with Current Address-Based Identity

Currently, all identity in Phase 1 is represented as Ethereum `address` values:
```
DocumentRecord.owner = 0x742d35Cc...
NotarySeal.notary    = 0x9f2c85De...
```

This creates three limitations the blueprint flags:
1. **No portable identity** — changing wallets loses all document history
2. **No credential binding** — notary licenses, bar admissions, and professional certifications can't be attached on-chain
3. **No cross-chain identity** — the same person on Polygon has a different "identity" than on Ethereum

---

## W3C DID Standard Summary

A DID is a URI that resolves to a **DID Document** containing public keys, services, and authentication methods:

```json
{
  "id": "did:ethr:0x742d35Cc...",
  "verificationMethod": [{
    "id": "did:ethr:0x742d35Cc...#key-1",
    "type": "EcdsaSecp256k1VerificationKey2019",
    "controller": "did:ethr:0x742d35Cc...",
    "publicKeyHex": "0x04b9..."
  }],
  "authentication": ["did:ethr:0x742d35Cc...#key-1"],
  "service": [{
    "id": "did:ethr:0x742d35Cc...#notary-credential",
    "type": "NotaryCredential",
    "serviceEndpoint": "https://credentials.ainotary.io/vc/notary/0x742d35Cc"
  }]
}
```

---

## Proposed DID Methods

| Method | Use Case | Resolver |
|---|---|---|
| `did:ethr` | Default — maps 1:1 to Ethereum address | uPort/Ethereum DID Registry |
| `did:key` | Self-contained ephemeral identity (no on-chain lookup) | Local key derivation |
| `did:web` | Enterprise/institutional notaries with a domain | HTTPS well-known URI |
| `did:ion` | Long-term immutable identity on Bitcoin Sidetree | ION network |

**Recommended primary method**: `did:ethr` — zero additional infrastructure, maps to existing wallet addresses, fully compatible with `ethers.js`.

---

## Integration Points in Existing Contracts

### 1. DocumentRegistry — DID-linked ownership

**Current:**
```solidity
struct DocumentRecord {
    address owner;   // raw Ethereum address
    // ...
}
```

**Phase 2 upgrade:**
```solidity
struct DocumentRecord {
    address owner;        // Ethereum address (kept for gas efficiency)
    bytes32 ownerDid;     // keccak256 of DID string (indexed for lookup)
    bytes32 credentialHash; // Hash of VC proving ownership right
    // ...
}

// New mapping for DID-based lookup
mapping(bytes32 => uint256[]) public didToDocuments; // ownerDid -> documentIds[]
```

**Interface:**
```solidity
interface IDIDRegistry {
    function registerDocument(
        bytes32 documentHash,
        bytes32 metadataHash,
        string calldata ipfsCID,
        uint8   documentType,
        string calldata jurisdiction,
        uint256 expiryDate,
        string calldata ownerDid,          // NEW: DID string
        bytes   calldata ownerDIDProof     // NEW: signature proving DID control
    ) external returns (uint256 documentId);
    
    function getDocumentsByDid(string calldata did) 
        external view returns (uint256[] memory);
}
```

### 2. NotaryNFT — Notary credential binding

**Phase 2 upgrade — mint requires a Verifiable Credential:**
```solidity
struct NotarySeal {
    // ... existing fields ...
    bytes32 notaryDid;          // NEW: DID of the notary
    bytes32 notaryCredHash;     // NEW: hash of notary's professional VC
    string  notaryCredUri;      // NEW: IPFS URI of the VC document
    uint256 credentialExpiry;   // NEW: when the notary license expires
}
```

```solidity
function mintNotarySeal(
    // ... existing params ...
    string calldata notaryDid,         // NEW
    bytes32         notaryCredHash,    // NEW  
    string calldata notaryCredUri,     // NEW
    uint256         credentialExpiry   // NEW
) external onlyRole(MINTER_ROLE) returns (uint256 tokenId);
```

### 3. ConditionalAccess — DID-gated policies

Allow policies to specify DID-based authorization instead of raw addresses:

```solidity
struct Condition {
    // ... existing fields ...
    bytes32 authorizedDid;    // NEW: keccak256(DID) of authorized entity
    bool    didGated;         // NEW: if true, check DID instead of address
}
```

---

## Off-Chain Verification Flow

```
1. User generates DID:
   did:ethr:mainnet:0x742d35Cc...

2. Professional credential issued by licensing body:
   VC signed by: did:web:nanotary.gov (National Notary Association)
   Subject: did:ethr:mainnet:0x742d35Cc...
   Claims: { notaryLicense: "CA-2024-12345", expires: "2026-12-31" }

3. User stores VC on IPFS:
   ipfs://QmVC1234...

4. User stores VC hash on-chain (DocumentRegistry.registerCredential):
   keccak256(VC JSON) -> bytes32 credHash

5. Protocol validates:
   - Signer address matches DID control key
   - VC issuer is in trusted-issuers registry (on-chain whitelist)
   - VC hasn't expired
   - VC subject DID matches signer's DID
```

---

## Trusted Issuer Registry (New Contract)

```solidity
// contracts/DIDRegistry.sol — Phase 2 deliverable
contract DIDRegistry is AccessControl {
    bytes32 public constant ISSUER_ADMIN = keccak256("ISSUER_ADMIN");
    
    // Whitelist of trusted VC issuers (e.g. National Notary Association DID)
    mapping(bytes32 => bool)   public trustedIssuers;  // keccak256(issuerDid) -> bool
    mapping(bytes32 => bool)   public revokedVCs;      // credHash -> revoked
    
    // DID -> Ethereum address binding (for reverse lookup)
    mapping(bytes32 => address) public didToAddress;   // keccak256(did) -> address
    mapping(address => bytes32) public addressToDid;   // address -> keccak256(did)
    
    function registerDid(string calldata did, bytes calldata proof) external;
    function addTrustedIssuer(string calldata issuerDid) external onlyRole(ISSUER_ADMIN);
    function revokeCredential(bytes32 credHash) external onlyRole(ISSUER_ADMIN);
    function isValidCredential(bytes32 credHash, bytes32 subjectDid, bytes32 issuerDid)
        external view returns (bool);
}
```

---

## Backward Compatibility Strategy

The DID integration must be **fully backward compatible** with existing Phase 1 deployments:

1. **Optional DID fields** — `ownerDid` defaults to `""` (empty string), `ownerDIDProof` defaults to `bytes("")` 
2. **Address-first** — existing `owner` address fields are preserved; DID fields are additive
3. **Gradual enforcement** — a `requireDid` flag on `DocumentRegistry` (admin-configurable) allows switching from optional to required per-jurisdiction

---

## Implementation Timeline

| Milestone | Target |
|---|---|
| `DIDRegistry.sol` contract | Phase 2, Sprint 1 |
| `DocumentRegistry` DID upgrade | Phase 2, Sprint 2 |
| `NotaryNFT` credential binding | Phase 2, Sprint 2 |
| Off-chain VC verification oracle | Phase 2, Sprint 3 |
| `ConditionalAccess` DID-gated policies | Phase 2, Sprint 3 |
| Trusted Issuer onboarding (NNA, state bodies) | Phase 2, Sprint 4 |

---

> **Key insight from the research**: The DID layer is the long-term moat. Once professional notaries are issuing credentials via the protocol's trusted issuer registry, switching costs are extremely high — their entire professional identity becomes portable only within this ecosystem.
