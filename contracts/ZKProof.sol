// SPDX-License-Identifier: BUSL-1.1
/**
 * ============================================================================
 * @title    ZKProof.sol
 * @author   Reece Dixon
 * @project  AI Autonomous Notary Protocol
 * @date     2026
 *
 * @notice   Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 *           Unauthorized copying, modification, or commercial use of this file,
 *           via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title ZKProof
 * @author AI Autonomous Notary Protocol
 * @notice Zero-knowledge proof verifier for document ownership and attribute
 *         attestation. Enables privacy-preserving compliance:
 *
 *   - Prove document ownership without revealing the document
 *   - Prove identity attribute (e.g. "over 18", "accredited investor")
 *     without revealing the underlying PII
 *   - Prove jurisdiction compliance without disclosing exact location
 *
 * @dev Supports Groth16 proof verification (4 G1 points + 8 Fp field elements).
 *      Verifier keys (vkHash) are registered per circuit type by ZK_ADMIN.
 *      Proof results are anchored on-chain for downstream contract consumption
 *      (e.g. ConditionalAccess.sol unlock conditions, DocumentMarketplace.sol
 *       investor verification).
 *
 *      The actual elliptic curve pairing checks would be implemented using
 *      Solidity precompiles (ecMul, ecAdd, ecPairing at addresses 0x06–0x08)
 *      or via a trusted verifier library. This contract defines the interface
 *      and state management; the pairing logic is in the `_verifyGroth16`
 *      internal function which should be replaced with a generated verifier
 *      from snarkjs/Noir when circuits are finalized.
 */
contract ZKProof is AccessControl, Pausable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // ─────────────────────────────────────────────────────────────────────────
    // Roles
    // ─────────────────────────────────────────────────────────────────────────

    bytes32 public constant ZK_ADMIN     = keccak256("ZK_ADMIN");
    bytes32 public constant CIRCUIT_REG  = keccak256("CIRCUIT_REG");

    // ─────────────────────────────────────────────────────────────────────────
    // Enums
    // ─────────────────────────────────────────────────────────────────────────

    enum CircuitType {
        DOCUMENT_OWNERSHIP,      // Prove ownership of doc with documentHash
        IDENTITY_ATTRIBUTE,      // Prove attribute without revealing identity
        JURISDICTION_COMPLIANCE, // Prove compliant jurisdiction without address
        ACCREDITED_INVESTOR,     // Prove accredited status
        CUSTOM                   // Protocol-extensible circuit type
    }

    enum ProofStatus {
        VALID,
        INVALID,
        EXPIRED,
        REVOKED
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Structs
    // ─────────────────────────────────────────────────────────────────────────

    struct VerificationKey {
        bytes32     vkHash;         // Keccak of the full verification key
        CircuitType circuitType;
        bool        active;
        uint256     registeredAt;
        string      description;
    }

    struct ProofRecord {
        uint256     proofId;
        bytes32     vkHash;         // Which circuit was used
        CircuitType circuitType;
        address     prover;         // Who submitted the proof
        bytes32     publicInputHash; // Keccak of the public inputs array
        ProofStatus status;
        uint256     verifiedAt;
        uint256     expiresAt;      // 0 = no expiry
        bytes32     contextHash;    // Optional: tie to a specific documentHash or actId
    }

    // ─────────────────────────────────────────────────────────────────────────
    // State
    // ─────────────────────────────────────────────────────────────────────────

    Counters.Counter private _proofIdCounter;

    mapping(bytes32 => VerificationKey) public verificationKeys;     // vkHash → VK
    mapping(uint256 => ProofRecord)     public proofRecords;         // proofId → record
    mapping(address => uint256[])       public proverProofs;         // prover → proof IDs
    mapping(bytes32 => uint256[])       public contextProofs;        // contextHash → proof IDs
    mapping(bytes32 => bool)            public nullifiers;           // used nullifiers (replay prevention)

    uint256 public defaultProofTtl; // Default proof validity period (seconds), 0 = indefinite

    // ─────────────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────────────

    event CircuitRegistered(bytes32 indexed vkHash, CircuitType circuitType, string description);
    event CircuitDeactivated(bytes32 indexed vkHash);

    event ProofVerified(
        uint256 indexed proofId,
        address indexed prover,
        bytes32 indexed vkHash,
        CircuitType circuitType,
        bytes32 contextHash
    );

    event ProofRejected(
        address indexed prover,
        bytes32 indexed vkHash,
        string reason
    );

    event ProofRevoked(uint256 indexed proofId, address indexed revoker);

    // ─────────────────────────────────────────────────────────────────────────
    // Constructor
    // ─────────────────────────────────────────────────────────────────────────

    constructor(address admin, uint256 _defaultProofTtl) {
        require(admin != address(0), "ZKProof: zero admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ZK_ADMIN,          admin);
        _grantRole(CIRCUIT_REG,       admin);
        defaultProofTtl = _defaultProofTtl;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Circuit Registry
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Register a new ZK circuit verification key.
     * @param vkHash       Keccak256 of the serialized Groth16 verification key
     * @param circuitType  Purpose of this circuit
     * @param description  Human-readable description
     */
    function registerCircuit(
        bytes32      vkHash,
        CircuitType  circuitType,
        string calldata description
    ) external onlyRole(CIRCUIT_REG) {
        require(vkHash != bytes32(0),            "ZKProof: zero vkHash");
        require(!verificationKeys[vkHash].active,"ZKProof: already registered");

        verificationKeys[vkHash] = VerificationKey({
            vkHash:       vkHash,
            circuitType:  circuitType,
            active:       true,
            registeredAt: block.timestamp,
            description:  description
        });

        emit CircuitRegistered(vkHash, circuitType, description);
    }

    /**
     * @notice Deactivate a circuit (e.g. if compromised). Existing valid proofs
     *         are NOT retroactively revoked — callers should check `vk.active`.
     */
    function deactivateCircuit(bytes32 vkHash) external onlyRole(ZK_ADMIN) {
        verificationKeys[vkHash].active = false;
        emit CircuitDeactivated(vkHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Proof Submission & Verification
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Submit and verify a Groth16 ZK proof on-chain.
     *
     * @param vkHash        Verification key identifying the circuit
     * @param publicInputs  Public inputs array (abi-encoded)
     * @param proofA        Groth16 πA point (2 field elements)
     * @param proofB        Groth16 πB point (4 field elements: 2 G2 coordinates)
     * @param proofC        Groth16 πC point (2 field elements)
     * @param nullifier     Unique value preventing double-use of same proof
     * @param contextHash   Optional association (documentHash, actId, etc.)
     * @param ttl           Validity period override (0 = use default)
     */
    function verifyProof(
        bytes32    vkHash,
        uint256[]  calldata publicInputs,
        uint256[2] calldata proofA,
        uint256[4] calldata proofB,
        uint256[2] calldata proofC,
        bytes32    nullifier,
        bytes32    contextHash,
        uint256    ttl
    ) external nonReentrant whenNotPaused returns (uint256 proofId) {
        VerificationKey storage vk = verificationKeys[vkHash];
        require(vk.active,            "ZKProof: circuit not active");
        require(!nullifiers[nullifier],"ZKProof: proof already used");
        require(publicInputs.length > 0, "ZKProof: no public inputs");

        bool valid = _verifyGroth16(vkHash, publicInputs, proofA, proofB, proofC);

        if (!valid) {
            emit ProofRejected(msg.sender, vkHash, "invalid proof");
            revert("ZKProof: proof verification failed");
        }

        // Mark nullifier as used
        nullifiers[nullifier] = true;

        _proofIdCounter.increment();
        proofId = _proofIdCounter.current();

        uint256 expiry = ttl > 0 ? block.timestamp + ttl :
                         (defaultProofTtl > 0 ? block.timestamp + defaultProofTtl : 0);

        proofRecords[proofId] = ProofRecord({
            proofId:         proofId,
            vkHash:          vkHash,
            circuitType:     vk.circuitType,
            prover:          msg.sender,
            publicInputHash: keccak256(abi.encodePacked(publicInputs)),
            status:          ProofStatus.VALID,
            verifiedAt:      block.timestamp,
            expiresAt:       expiry,
            contextHash:     contextHash
        });

        proverProofs[msg.sender].push(proofId);
        if (contextHash != bytes32(0)) {
            contextProofs[contextHash].push(proofId);
        }

        emit ProofVerified(proofId, msg.sender, vkHash, vk.circuitType, contextHash);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Proof Status Queries
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Check if a proof is currently valid (not expired or revoked).
     */
    function isProofValid(uint256 proofId) public view returns (bool) {
        ProofRecord storage r = proofRecords[proofId];
        if (r.status != ProofStatus.VALID)          return false;
        if (r.expiresAt != 0 && block.timestamp > r.expiresAt) return false;
        return true;
    }

    /**
     * @notice Find the latest valid proof for a prover of a given circuit type.
     */
    function latestValidProof(
        address     prover,
        CircuitType circuitType
    ) external view returns (uint256 proofId, bool found) {
        uint256[] storage ids = proverProofs[prover];
        for (uint256 i = ids.length; i > 0; i--) {
            uint256 pid = ids[i - 1];
            if (
                proofRecords[pid].circuitType == circuitType &&
                isProofValid(pid)
            ) {
                return (pid, true);
            }
        }
        return (0, false);
    }

    /**
     * @notice Check if a context (document/act) has a valid proof of a given type.
     */
    function contextHasValidProof(
        bytes32     contextHash,
        CircuitType circuitType
    ) external view returns (bool) {
        uint256[] storage ids = contextProofs[contextHash];
        for (uint256 i = 0; i < ids.length; i++) {
            ProofRecord storage r = proofRecords[ids[i]];
            if (r.circuitType == circuitType && isProofValid(ids[i])) {
                return true;
            }
        }
        return false;
    }

    function getProof(uint256 proofId) external view returns (ProofRecord memory) {
        return proofRecords[proofId];
    }

    function getProverProofs(address prover) external view returns (uint256[] memory) {
        return proverProofs[prover];
    }

    function getContextProofs(bytes32 contextHash) external view returns (uint256[] memory) {
        return contextProofs[contextHash];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Revocation
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @notice Admin can revoke a proof (e.g. if underlying credentials revoked).
     */
    function revokeProof(uint256 proofId) external onlyRole(ZK_ADMIN) {
        proofRecords[proofId].status = ProofStatus.REVOKED;
        emit ProofRevoked(proofId, msg.sender);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────────────

    function setDefaultTtl(uint256 ttl) external onlyRole(ZK_ADMIN) {
        defaultProofTtl = ttl;
    }

    function pause()   external onlyRole(ZK_ADMIN) { _pause(); }
    function unpause() external onlyRole(ZK_ADMIN) { _unpause(); }

    // ─────────────────────────────────────────────────────────────────────────
    // Internal — Groth16 Verifier
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * @dev Groth16 verification stub. In production this function is replaced
     *      by auto-generated Solidity verifier output from snarkjs or Noir.
     *
     *      The check is: e(A, B) == e(alpha, beta) * e(L, gamma) * e(C, delta)
     *      where L = sum(publicInputs[i] * IC[i]).
     *
     *      The precompile at 0x08 (ecPairing) handles the bilinear pairing check.
     *      Until circuits are finalized we defer to the registered vkHash as a
     *      commitment and perform basic structural validation only.
     */
    function _verifyGroth16(
        bytes32    vkHash,
        uint256[]  calldata publicInputs,
        uint256[2] calldata proofA,
        uint256[4] calldata proofB,
        uint256[2] calldata proofC
    ) internal view returns (bool) {
        // Structural checks — replace with real pairing verification in production
        require(vkHash   != bytes32(0), "ZKProof: zero vkHash");
        require(proofA[0] != 0 || proofA[1] != 0, "ZKProof: zero A point");
        require(proofC[0] != 0 || proofC[1] != 0, "ZKProof: zero C point");
        require(publicInputs.length > 0,            "ZKProof: empty inputs");

        // BN254 field prime — inputs must be less than p
        uint256 p = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
        for (uint256 i = 0; i < publicInputs.length; i++) {
            require(publicInputs[i] < p, "ZKProof: input out of field");
        }

        // In production, call ecPairing precompile (address 0x08):
        //   return _callPairing(proofA, proofB, proofC, vk, publicInputs);
        // For now, return true for valid structure (MUST be replaced before mainnet)
        return proofB[0] != 0 || proofB[1] != 0 || proofB[2] != 0 || proofB[3] != 0;
    }
}
