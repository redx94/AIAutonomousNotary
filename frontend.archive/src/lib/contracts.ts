export const NOTARY_NFT_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const DOCUMENT_REGISTRY_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const FRACTIONALIZATION_VAULT_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const DOCUMENT_MARKETPLACE_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const AMM_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const AUCTION_HOUSE_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const LENDING_PROTOCOL_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const NOTARY_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const GOVERNANCE_ADDRESS = "0x0000000000000000000000000000000000000000" as const
export const TREASURY_ADDRESS = "0x0000000000000000000000000000000000000000" as const

export const CONTRACTS = {
  NotaryNFT: NOTARY_NFT_ADDRESS,
  DocumentRegistry: DOCUMENT_REGISTRY_ADDRESS,
  FractionalizationVault: FRACTIONALIZATION_VAULT_ADDRESS,
  DocumentMarketplace: DOCUMENT_MARKETPLACE_ADDRESS,
  AMM: AMM_ADDRESS,
  AuctionHouse: AUCTION_HOUSE_ADDRESS,
  LendingProtocol: LENDING_PROTOCOL_ADDRESS,
  NotaryToken: NOTARY_TOKEN_ADDRESS,
  Governance: GOVERNANCE_ADDRESS,
  Treasury: TREASURY_ADDRESS,
} as const

export const DOCUMENT_REGISTRY_ABI = [
  {
    name: "getDocument",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "documentHash", type: "bytes32" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "documentHash", type: "bytes32" },
          { name: "registeredAt", type: "uint256" },
          { name: "notaryAddress", type: "address" },
          { name: "tokenId", type: "uint256" },
          { name: "documentType", type: "string" },
        ],
      },
    ],
  },
] as const

export const NOTARY_NFT_ABI = [
  {
    name: "tokenURI",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    name: "ownerOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "owner", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export const FRACTIONALIZATION_VAULT_ABI = [
  {
    name: "sharePrice",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const

export const DOCUMENT_MARKETPLACE_ABI = [
  {
    name: "getOrder",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "orderId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "orderId", type: "uint256" },
          { name: "tokenAddress", type: "address" },
          { name: "price", type: "uint256" },
          { name: "quantity", type: "uint256" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    name: "getUserOrders",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ name: "", type: "uint256[]" }],
  },
] as const
