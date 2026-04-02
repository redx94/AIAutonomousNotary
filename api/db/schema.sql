/**
 * ============================================================================
 * File:      api/db/schema.sql
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * PostgreSQL schema for the AI Autonomous Notary API.
 * Replaces in-memory overlay state with persistent storage.
 *
 * Run: psql -U postgres -d ainotary -f api/db/schema.sql
 */

-- ─────────────────────────────────────────────────────────────────────────────
-- Extensions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─────────────────────────────────────────────────────────────────────────────
-- Enums
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TYPE document_status   AS ENUM ('PENDING','VALIDATED','NOTARIZED','EXPIRED','DISPUTED','CANCELLED');
CREATE TYPE document_type     AS ENUM ('DEED','CONTRACT','WILL','POWER_OF_ATTORNEY','AFFIDAVIT','CERTIFICATE','PATENT','OTHER');
CREATE TYPE seal_status       AS ENUM ('ACTIVE','SUSPENDED','REVOKED','EXPIRED');
CREATE TYPE vault_state       AS ENUM ('OPEN','BUYOUT_INITIATED','CLOSED');
CREATE TYPE auction_type      AS ENUM ('DUTCH','ENGLISH');
CREATE TYPE auction_status    AS ENUM ('OPEN','SETTLED','CANCELLED');
CREATE TYPE order_side        AS ENUM ('BID','ASK');
CREATE TYPE order_status      AS ENUM ('OPEN','FILLED','CANCELLED','PARTIALLY_FILLED');
CREATE TYPE analysis_status   AS ENUM ('PENDING','IN_PROGRESS','COMPLETE','FAILED');
CREATE TYPE offering_type     AS ENUM ('REG_D','REG_S','REG_A_PLUS','UNRESTRICTED');
CREATE TYPE erasure_status    AS ENUM ('PENDING','IN_PROGRESS','COMPLETE','REJECTED','PARTIAL');

-- ─────────────────────────────────────────────────────────────────────────────
-- Documents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS documents (
    id              SERIAL PRIMARY KEY,
    owner_address   VARCHAR(42) NOT NULL,
    document_hash   VARCHAR(66) NOT NULL UNIQUE, -- 0x-prefixed keccak256
    ipfs_cid        VARCHAR(255),
    title           TEXT,
    jurisdiction    VARCHAR(20) NOT NULL DEFAULT 'US',
    document_type   document_type NOT NULL DEFAULT 'OTHER',
    status          document_status NOT NULL DEFAULT 'PENDING',
    token_id        VARCHAR(78),   -- On-chain ERC-721 token ID
    version_count   INTEGER NOT NULL DEFAULT 1,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_owner    ON documents(owner_address);
CREATE INDEX idx_documents_hash     ON documents(document_hash);
CREATE INDEX idx_documents_token_id ON documents(token_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notary Seals (mirrors NotaryNFT on-chain state)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notary_seals (
    id               SERIAL PRIMARY KEY,
    token_id         VARCHAR(78) NOT NULL UNIQUE,
    document_hash    VARCHAR(66) NOT NULL,
    notary_address   VARCHAR(42) NOT NULL,
    owner_address    VARCHAR(42) NOT NULL,
    seal_status      seal_status NOT NULL DEFAULT 'ACTIVE',
    doc_type         document_type NOT NULL DEFAULT 'OTHER',
    jurisdiction     VARCHAR(20),
    ipfs_cid         VARCHAR(255),
    ai_validated     BOOLEAN NOT NULL DEFAULT FALSE,
    confidence_score INTEGER,              -- 0-10000 basis points
    minted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expiry_date      TIMESTAMPTZ,
    metadata         JSONB,
    tx_hash          VARCHAR(66)           -- Mint transaction hash
);

CREATE INDEX idx_seals_owner ON notary_seals(owner_address);
CREATE INDEX idx_seals_hash  ON notary_seals(document_hash);

-- ─────────────────────────────────────────────────────────────────────────────
-- Mint Requests
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS mint_requests (
    id                SERIAL PRIMARY KEY,
    document_id       INTEGER NOT NULL REFERENCES documents(id),
    requester_address VARCHAR(42) NOT NULL,
    notary_address    VARCHAR(42),
    expiry_date       TIMESTAMPTZ,
    status            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tx_hash           VARCHAR(66),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(document_id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- AI Analyses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_analyses (
    id                 SERIAL PRIMARY KEY,
    document_id        INTEGER NOT NULL REFERENCES documents(id),
    requester_address  VARCHAR(42) NOT NULL,
    jurisdiction       VARCHAR(20) NOT NULL DEFAULT 'US',
    language           VARCHAR(20) NOT NULL DEFAULT 'ENGLISH',
    status             analysis_status NOT NULL DEFAULT 'PENDING',
    risk_score         INTEGER,             -- 0-100
    recommendation     VARCHAR(50),
    confidence         NUMERIC(5,4),        -- 0.0000 - 1.0000
    fraud_signals      JSONB DEFAULT '[]',
    document_findings  JSONB DEFAULT '[]',
    identity_findings  JSONB DEFAULT '[]',
    provider           VARCHAR(50),         -- AI provider used (e.g. "openai", "custom")
    on_chain_request_id BIGINT,             -- AIEngine.sol requestId
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at       TIMESTAMPTZ
);

CREATE INDEX idx_analyses_document ON ai_analyses(document_id);
CREATE INDEX idx_analyses_status   ON ai_analyses(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- NLP Results
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS nlp_results (
    id               SERIAL PRIMARY KEY,
    analysis_id      INTEGER NOT NULL REFERENCES ai_analyses(id),
    contract_type    VARCHAR(50),
    total_clauses    INTEGER,
    flagged_clauses  INTEGER,
    risk_score       INTEGER,               -- 0-10000
    jurisdiction_compliant BOOLEAN,
    party_roles      JSONB DEFAULT '[]',
    clauses          JSONB DEFAULT '[]',    -- Array of ClauseResult objects
    result_hash      VARCHAR(66),           -- On-chain resultHash
    on_chain_request_id BIGINT,
    analyzed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Fraud Signals
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fraud_signals (
    id             SERIAL PRIMARY KEY,
    document_id    INTEGER REFERENCES documents(id),
    document_hash  VARCHAR(66) NOT NULL,
    subject_address VARCHAR(42),
    signal_type    VARCHAR(50) NOT NULL,
    score          INTEGER NOT NULL,        -- 0-10000
    reporter       VARCHAR(42),
    evidence       TEXT,
    verified       BOOLEAN DEFAULT FALSE,
    disputed       BOOLEAN DEFAULT FALSE,
    on_chain_id    BIGINT,
    reported_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_fraud_document ON fraud_signals(document_hash);
CREATE INDEX idx_fraud_subject  ON fraud_signals(subject_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- Overlay Audit Events (replaces file-based exports)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS overlay_events (
    id          BIGSERIAL PRIMARY KEY,
    act_id      VARCHAR(100) NOT NULL,
    event_type  VARCHAR(50)  NOT NULL,
    payload     JSONB        NOT NULL,
    occurred_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_events_act_id     ON overlay_events(act_id);
CREATE INDEX idx_events_type       ON overlay_events(event_type);
CREATE INDEX idx_events_occurred   ON overlay_events(occurred_at);

-- ─────────────────────────────────────────────────────────────────────────────
-- Evidence Bundles
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_bundles (
    id          SERIAL PRIMARY KEY,
    act_id      VARCHAR(100) NOT NULL UNIQUE,
    bundle_hash VARCHAR(66),
    ipfs_cid    VARCHAR(255),
    manifest    JSONB,
    artifacts   JSONB DEFAULT '[]',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Vaults (mirrors FractionalizationVault on-chain)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS vaults (
    id                   SERIAL PRIMARY KEY,
    vault_address        VARCHAR(42) NOT NULL UNIQUE,
    nft_token_id         VARCHAR(78) NOT NULL,
    original_owner       VARCHAR(42) NOT NULL,
    total_shares         NUMERIC(38,0) NOT NULL,
    floor_price          NUMERIC(38,0) NOT NULL,   -- wei
    fee_rate_bp          INTEGER NOT NULL,
    fee_recipient        VARCHAR(42),
    state                vault_state NOT NULL DEFAULT 'OPEN',
    buyout_initiator     VARCHAR(42),
    buyout_price         NUMERIC(38,0),
    buyout_deadline      TIMESTAMPTZ,
    total_distributed    NUMERIC(38,0) DEFAULT 0,
    distribution_index   NUMERIC(38,0) DEFAULT 0,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Share Holdings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS share_holdings (
    id               SERIAL PRIMARY KEY,
    vault_address    VARCHAR(42) NOT NULL,
    holder_address   VARCHAR(42) NOT NULL,
    balance          NUMERIC(38,0) NOT NULL DEFAULT 0,
    holder_index     NUMERIC(38,0) NOT NULL DEFAULT 0, -- Revenue distribution index snapshot
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(vault_address, holder_address)
);

CREATE INDEX idx_holdings_holder ON share_holdings(holder_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- Marketplace Orders
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketplace_orders (
    id               SERIAL PRIMARY KEY,
    order_id         BIGINT NOT NULL UNIQUE,  -- On-chain orderId
    maker_address    VARCHAR(42) NOT NULL,
    vault_address    VARCHAR(42) NOT NULL,
    side             order_side NOT NULL,
    status           order_status NOT NULL DEFAULT 'OPEN',
    amount           NUMERIC(38,0) NOT NULL,
    filled           NUMERIC(38,0) NOT NULL DEFAULT 0,
    price_per_share  NUMERIC(38,0) NOT NULL,  -- wei per 1e18 shares
    expires_at       TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_orders_vault  ON marketplace_orders(vault_address);
CREATE INDEX idx_orders_maker  ON marketplace_orders(maker_address);
CREATE INDEX idx_orders_status ON marketplace_orders(status);

-- ─────────────────────────────────────────────────────────────────────────────
-- Purchase Intents (off-chain UI state before tx)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS purchase_intents (
    id             SERIAL PRIMARY KEY,
    vault_address  VARCHAR(42) NOT NULL,
    buyer_address  VARCHAR(42) NOT NULL,
    amount         NUMERIC(38,0) NOT NULL,
    max_price      NUMERIC(38,0) NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tx_hash        VARCHAR(66),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Auctions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS auctions (
    id              SERIAL PRIMARY KEY,
    auction_id      BIGINT NOT NULL UNIQUE,  -- On-chain auctionId
    auction_type    auction_type NOT NULL,
    auction_status  auction_status NOT NULL DEFAULT 'OPEN',
    seller_address  VARCHAR(42) NOT NULL,
    asset_token     VARCHAR(42) NOT NULL,
    asset_id        BIGINT,
    asset_amount    NUMERIC(38,0),
    start_price     NUMERIC(38,0) NOT NULL,
    end_price       NUMERIC(38,0),
    start_time      TIMESTAMPTZ NOT NULL,
    end_time        TIMESTAMPTZ NOT NULL,
    high_bidder     VARCHAR(42),
    high_bid        NUMERIC(38,0),
    metadata_uri    TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Lending Positions
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS lending_positions (
    id                SERIAL PRIMARY KEY,
    position_id       BIGINT NOT NULL UNIQUE,  -- On-chain positionId
    borrower_address  VARCHAR(42) NOT NULL,
    collateral_type   VARCHAR(10) NOT NULL,  -- 'ERC721' | 'ERC20'
    col_token         VARCHAR(42) NOT NULL,
    col_id            BIGINT,
    col_amount        NUMERIC(38,0),
    principal_debt    NUMERIC(38,0) NOT NULL,
    accrued_interest  NUMERIC(38,0) NOT NULL DEFAULT 0,
    last_accrual      TIMESTAMPTZ NOT NULL,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lending_borrower ON lending_positions(borrower_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- Signing Sessions (multi-party)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS signing_sessions (
    id                    SERIAL PRIMARY KEY,
    document_id           INTEGER NOT NULL REFERENCES documents(id),
    notary_address        VARCHAR(42),
    required_signatures   INTEGER NOT NULL DEFAULT 1,
    collected_signatures  INTEGER NOT NULL DEFAULT 0,
    status                VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS signatories (
    id               SERIAL PRIMARY KEY,
    session_id       INTEGER NOT NULL REFERENCES signing_sessions(id),
    signer_address   VARCHAR(42) NOT NULL,
    signature        TEXT,
    signature_hash   VARCHAR(66),
    signed_at        TIMESTAMPTZ,
    UNIQUE(session_id, signer_address)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Notary Earnings
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notary_earnings (
    id              SERIAL PRIMARY KEY,
    notary_address  VARCHAR(42) NOT NULL,
    document_id     INTEGER REFERENCES documents(id),
    amount_wei      NUMERIC(38,0) NOT NULL,
    tx_hash         VARCHAR(66),
    earned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_earnings_notary ON notary_earnings(notary_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- DID Credentials
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS did_credentials (
    id               SERIAL PRIMARY KEY,
    holder_address   VARCHAR(42) NOT NULL,
    did              TEXT NOT NULL,
    credential_type  VARCHAR(50) NOT NULL,
    credential_hash  VARCHAR(66),
    issuer_did       TEXT,
    valid_until      TIMESTAMPTZ,
    revoked          BOOLEAN NOT NULL DEFAULT FALSE,
    issued_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_did_holder ON did_credentials(holder_address);

-- ─────────────────────────────────────────────────────────────────────────────
-- Oracle Nodes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS oracle_nodes (
    id                SERIAL PRIMARY KEY,
    address           VARCHAR(42) NOT NULL UNIQUE,
    name              VARCHAR(100),
    reputation_score  INTEGER NOT NULL DEFAULT 5000,  -- 0-10000
    total_responses   INTEGER NOT NULL DEFAULT 0,
    active            BOOLEAN NOT NULL DEFAULT TRUE,
    registered_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active_at    TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS oracle_responses (
    id              BIGSERIAL PRIMARY KEY,
    request_id      BIGINT NOT NULL,
    oracle_address  VARCHAR(42) NOT NULL,
    is_valid        BOOLEAN NOT NULL,
    confidence      INTEGER,              -- 0-10000
    fraud_score     INTEGER,             -- 0-10000
    submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Yield Claim Intents
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS yield_claim_intents (
    id              SERIAL PRIMARY KEY,
    vault_address   VARCHAR(42) NOT NULL,
    claimer_address VARCHAR(42) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    tx_hash         VARCHAR(66),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Governance Proposals (off-chain mirror of Governance.sol)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS governance_proposals (
    id               SERIAL PRIMARY KEY,
    proposal_id      BIGINT NOT NULL UNIQUE,  -- On-chain proposalId
    proposer_address VARCHAR(42) NOT NULL,
    category         VARCHAR(50) NOT NULL,
    description      TEXT,
    ipfs_cid         TEXT,
    voting_start     TIMESTAMPTZ NOT NULL,
    voting_end       TIMESTAMPTZ NOT NULL,
    for_votes        NUMERIC(38,0) NOT NULL DEFAULT 0,
    against_votes    NUMERIC(38,0) NOT NULL DEFAULT 0,
    abstain_votes    NUMERIC(38,0) NOT NULL DEFAULT 0,
    state            VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────────────────────────────────────
-- GDPR Records
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS gdpr_erasure_requests (
    id                SERIAL PRIMARY KEY,
    on_chain_id       BIGINT NOT NULL UNIQUE,  -- GDPRManager.sol requestId
    data_subject      VARCHAR(42) NOT NULL,
    document_hash     VARCHAR(66),
    status            erasure_status NOT NULL DEFAULT 'PENDING',
    request_reason    TEXT,
    rejection_reason  TEXT,
    requested_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS gdpr_consent_records (
    id                SERIAL PRIMARY KEY,
    on_chain_id       BIGINT NOT NULL UNIQUE,
    data_subject      VARCHAR(42) NOT NULL,
    document_hash     VARCHAR(66),
    legal_basis       VARCHAR(50) NOT NULL,
    purpose_cid       TEXT,
    granted_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at        TIMESTAMPTZ,
    withdrawn         BOOLEAN NOT NULL DEFAULT FALSE,
    withdrawn_at      TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_evidence_bundles_act ON evidence_bundles(act_id);
CREATE INDEX IF NOT EXISTS idx_vaults_owner         ON vaults(original_owner);
CREATE INDEX IF NOT EXISTS idx_vaults_state         ON vaults(state);
