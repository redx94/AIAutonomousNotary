/**
 * ============================================================================
 * File:      hardhat.config.js
 * Author:   Reece Dixon
 * Project:  AI Autonomous Notary Protocol
 * 
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * Unauthorized copying, modification, or commercial use of this file,
 * via any medium, is strictly prohibited until the license Change Date.
 * ============================================================================
 */
require("@nomicfoundation/hardhat-toolbox");
require("hardhat-contract-sizer");
require("hardhat-gas-reporter");
require("solidity-coverage");
require("dotenv").config();

const {
  PRIVATE_KEY,
  SEPOLIA_RPC_URL,
  POLYGON_RPC_URL,
  MAINNET_RPC_URL,
  ETHERSCAN_API_KEY,
  POLYGONSCAN_API_KEY,
  COINMARKETCAP_API_KEY,
} = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },

  networks: {
    // Local development
    hardhat: {
      chainId: 31337,
      allowUnlimitedContractSize: false,
      gas: 12000000,
      gasPrice: 8000000000,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },

    // Testnets
    sepolia: {
      url: SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 11155111,
      gas: 6000000,
      gasPrice: "auto",
    },
    mumbai: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 80001,
      gas: 6000000,
      gasPrice: "auto",
    },

    // Mainnets
    mainnet: {
      url: MAINNET_RPC_URL || "https://eth.llamarpc.com",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 1,
      gas: 6000000,
      gasPrice: "auto",
    },
    polygon: {
      url: POLYGON_RPC_URL || "https://polygon-rpc.com",
      accounts: PRIVATE_KEY ? [`0x${PRIVATE_KEY}`] : [],
      chainId: 137,
      gas: 6000000,
      gasPrice: "auto",
    },
  },

  etherscan: {
    apiKey: {
      mainnet: ETHERSCAN_API_KEY || "",
      sepolia: ETHERSCAN_API_KEY || "",
      polygon: POLYGONSCAN_API_KEY || "",
      polygonMumbai: POLYGONSCAN_API_KEY || "",
    },
  },

  gasReporter: {
    enabled: process.env.REPORT_GAS === "true",
    currency: "USD",
    outputFile: "gas-report.txt",
    noColors: true,
    coinmarketcap: COINMARKETCAP_API_KEY || "",
    token: "ETH",
    gasPriceApi: "https://api.etherscan.io/api?module=proxy&action=eth_gasPrice",
  },

  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [],
  },

  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },

  mocha: {
    timeout: 120000,
    parallel: false,
  },
};
