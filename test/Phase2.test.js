/**
 * ============================================================================
 * File:      test/Phase2.test.js
 * Author:    Reece Dixon
 * Project:   AI Autonomous Notary Protocol
 *
 * Copyright (c) 2026 Reece Dixon - All Rights Reserved.
 * ============================================================================
 *
 * Phase 2 contract tests:
 *   - NotaryToken: fixed supply, allocations, ERC20Votes
 *   - Treasury: deposits, small spend, large spend timelock
 *   - DocumentMarketplace: limit orders, market buy/sell, cancellation
 *   - AMM: pool creation, liquidity, swaps
 *   - AuctionHouse: Dutch and English auction flows
 *   - LendingProtocol: deposit, borrow, repay, liquidation
 */

const { expect }   = require("chai");
const { ethers }   = require("hardhat");
const { time }     = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const ONE_ETHER    = ethers.parseEther("1");
const HUNDRED_ETHER = ethers.parseEther("100");

// ─────────────────────────────────────────────────────────────────────────────
// NotaryToken
// ─────────────────────────────────────────────────────────────────────────────

describe("NotaryToken", () => {
  let token, admin, treasury, ecosystem, team, investor, liquidity, reserve;

  before(async () => {
    [admin, treasury, ecosystem, team, investor, liquidity, reserve] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("NotaryToken");
    token = await Factory.deploy(
      admin.address, treasury.address, ecosystem.address,
      liquidity.address, reserve.address, team.address, investor.address
    );
  });

  it("mints exactly 100,000,000 NOTARY", async () => {
    const total = await token.totalSupply();
    expect(total).to.equal(ethers.parseEther("100000000"));
  });

  it("allocates 25M to treasury", async () => {
    expect(await token.balanceOf(treasury.address)).to.equal(ethers.parseEther("25000000"));
  });

  it("allocates 20M to ecosystem", async () => {
    expect(await token.balanceOf(ecosystem.address)).to.equal(ethers.parseEther("20000000"));
  });

  it("allocates 15M to investor vesting", async () => {
    expect(await token.balanceOf(investor.address)).to.equal(ethers.parseEther("15000000"));
  });

  it("supports delegation for ERC20Votes", async () => {
    await token.connect(treasury).delegate(treasury.address);
    expect(await token.getVotes(treasury.address)).to.be.gt(0n);
  });

  it("admin can pause and unpause", async () => {
    await token.connect(admin).pause();
    await expect(
      token.connect(treasury).transfer(admin.address, ONE_ETHER)
    ).to.be.revertedWith("Pausable: paused");
    await token.connect(admin).unpause();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Treasury
// ─────────────────────────────────────────────────────────────────────────────

describe("Treasury", () => {
  let treasury, admin, treasurer, approver2, recipient;

  before(async () => {
    [admin, treasurer, approver2, recipient] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("Treasury");
    treasury = await Factory.deploy(
      admin.address,
      ethers.parseEther("0.1"),  // smallSpendLimit
      2n                          // requiredApprovals
    );
    // Grant roles
    await treasury.grantRole(await treasury.TREASURER_ROLE(), treasurer.address);
    await treasury.grantRole(await treasury.SPEND_APPROVER(), approver2.address);
    // Fund treasury
    await admin.sendTransaction({ to: await treasury.getAddress(), value: ethers.parseEther("5") });
  });

  it("accepts ETH deposits", async () => {
    expect(await treasury.ethBalance()).to.be.gte(ethers.parseEther("5"));
  });

  it("allows small spend by treasurer", async () => {
    const before = await ethers.provider.getBalance(recipient.address);
    await treasury.connect(treasurer).smallSpendEth(
      recipient.address,
      ethers.parseEther("0.05"),
      "test spend"
    );
    const after = await ethers.provider.getBalance(recipient.address);
    expect(after - before).to.equal(ethers.parseEther("0.05"));
  });

  it("rejects small spend exceeding limit", async () => {
    await expect(
      treasury.connect(treasurer).smallSpendEth(
        recipient.address,
        ethers.parseEther("0.2"),
        "too large"
      )
    ).to.be.revertedWith("Treasury: exceeds small spend limit");
  });

  it("large spend requires timelock + approvals", async () => {
    const requestId = 1;
    await treasury.connect(treasurer).requestSpend(
      recipient.address,
      ethers.ZeroAddress,
      ethers.parseEther("1"),
      "large spend",
      ""
    );

    // Cannot execute before timelock
    await treasury.connect(admin).approveSpend(1);
    await treasury.connect(approver2).approveSpend(1);

    await expect(
      treasury.connect(admin).executeSpend(1)
    ).to.be.revertedWith("Treasury: timelock active");

    // Fast-forward 48 hours
    await time.increase(49 * 60 * 60);
    await treasury.connect(admin).executeSpend(1);

    const { executed } = await treasury.getSpendRequest(1);
    expect(executed).to.be.true;
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// DocumentMarketplace
// ─────────────────────────────────────────────────────────────────────────────

describe("DocumentMarketplace", () => {
  let marketplace, shareToken, admin, seller, buyer, treasuryAddr;

  before(async () => {
    [admin, seller, buyer] = await ethers.getSigners();

    // Deploy a mock ERC-20 as share token
    const MockERC20 = await ethers.getContractFactory("DocumentSecurityToken");
    shareToken = await MockERC20.deploy(
      "Test Shares", "TSHARE",
      ethers.keccak256(ethers.toUtf8Bytes("test-doc")),
      ethers.parseEther("1000000"),
      "US",
      ethers.parseEther("1"),
      admin.address
    );

    // Fund seller with share tokens
    await shareToken.setAccreditedInvestor(seller.address, true);
    await shareToken.transfer(seller.address, ethers.parseEther("10000"));

    const Treasury = await ethers.getContractFactory("Treasury");
    const tContract = await Treasury.deploy(admin.address, ONE_ETHER, 2n);
    treasuryAddr = await tContract.getAddress();

    const Factory = await ethers.getContractFactory("DocumentMarketplace");
    marketplace = await Factory.deploy(admin.address, treasuryAddr, 50n); // 0.5% fee
  });

  it("places a limit ask order", async () => {
    const tokenAddr = await shareToken.getAddress();
    const mktAddr   = await marketplace.getAddress();
    await shareToken.connect(seller).approve(mktAddr, ethers.parseEther("100"));

    const tx = await marketplace.connect(seller).placeLimitAsk(
      tokenAddr,
      ethers.parseEther("100"),
      ONE_ETHER, // 1 ETH per 1e18 shares
      0n
    );
    await tx.wait();

    const [price, amount] = await marketplace.bestAsk(tokenAddr);
    expect(price).to.equal(ONE_ETHER);
    expect(amount).to.equal(ethers.parseEther("100"));
  });

  it("market buy fills the ask order", async () => {
    const tokenAddr = await shareToken.getAddress();
    const buyerBefore = await shareToken.balanceOf(buyer.address);

    await marketplace.connect(buyer).marketBuy(
      tokenAddr,
      ethers.parseEther("10"),
      { value: ethers.parseEther("10") } // 10 ETH for 10 shares at 1 ETH each
    );

    const buyerAfter = await shareToken.balanceOf(buyer.address);
    expect(buyerAfter - buyerBefore).to.equal(ethers.parseEther("10"));
  });

  it("seller can cancel an open order", async () => {
    const tokenAddr = await shareToken.getAddress();
    const mktAddr   = await marketplace.getAddress();
    await shareToken.connect(seller).approve(mktAddr, ethers.parseEther("50"));

    await marketplace.connect(seller).placeLimitAsk(
      tokenAddr,
      ethers.parseEther("50"),
      ethers.parseEther("2"),
      0n
    );

    const orders = await marketplace.getUserOrders(seller.address);
    const lastOrderId = orders[orders.length - 1];

    await marketplace.connect(seller).cancelOrder(lastOrderId);
    const order = await marketplace.getOrder(lastOrderId);
    expect(order.status).to.equal(3n); // CANCELLED
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AMM
// ─────────────────────────────────────────────────────────────────────────────

describe("AMM", () => {
  let amm, shareToken, admin, provider1, trader;

  before(async () => {
    [admin, provider1, trader] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("DocumentSecurityToken");
    shareToken = await MockERC20.deploy(
      "AMM Share", "AMMSH",
      ethers.keccak256(ethers.toUtf8Bytes("amm-doc")),
      ethers.parseEther("1000000"),
      "US",
      ethers.parseEther("1"),
      admin.address
    );

    await shareToken.setAccreditedInvestor(provider1.address, true);
    await shareToken.transfer(provider1.address, ethers.parseEther("50000"));

    const Treasury = await ethers.getContractFactory("Treasury");
    const tContract = await Treasury.deploy(admin.address, ONE_ETHER, 2n);

    const Factory = await ethers.getContractFactory("AMM");
    amm = await Factory.deploy(admin.address, await tContract.getAddress(), 2000n);

    // Create pool
    const tokenAddr = await shareToken.getAddress();
    await amm.createPool(tokenAddr, 30n); // 0.3% fee
  });

  it("adds initial liquidity and mints LP tokens", async () => {
    const tokenAddr = await shareToken.getAddress();
    const ammAddr   = await amm.getAddress();

    await shareToken.connect(provider1).approve(ammAddr, ethers.parseEther("1000"));

    await amm.connect(provider1).addLiquidity(
      tokenAddr,
      ethers.parseEther("1000"),
      ethers.parseEther("990"),
      ethers.parseEther("0.99"),
      { value: ethers.parseEther("10") }
    );

    const lpBalance = await amm.getLPBalance(tokenAddr, provider1.address);
    expect(lpBalance).to.be.gt(0n);
  });

  it("swaps ETH for tokens", async () => {
    const tokenAddr   = await shareToken.getAddress();
    const ammAddr     = await amm.getAddress();
    const balBefore   = await shareToken.balanceOf(trader.address);

    await amm.connect(trader).swapEthForTokens(
      tokenAddr,
      0n,   // amountOutMin (no slippage guard in test)
      { value: ethers.parseEther("1") }
    );

    const balAfter = await shareToken.balanceOf(trader.address);
    expect(balAfter).to.be.gt(balBefore);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// AuctionHouse
// ─────────────────────────────────────────────────────────────────────────────

describe("AuctionHouse", () => {
  let auctionHouse, shareToken, admin, seller, bidder1, bidder2;

  before(async () => {
    [admin, seller, bidder1, bidder2] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("DocumentSecurityToken");
    shareToken = await MockERC20.deploy(
      "Auction Share", "AUSH",
      ethers.keccak256(ethers.toUtf8Bytes("auction-doc")),
      ethers.parseEther("1000000"),
      "US",
      ethers.parseEther("1"),
      admin.address
    );

    await shareToken.setAccreditedInvestor(seller.address, true);
    await shareToken.transfer(seller.address, ethers.parseEther("10000"));

    const Treasury = await ethers.getContractFactory("Treasury");
    const tContract = await Treasury.deploy(admin.address, ONE_ETHER, 2n);

    const Factory = await ethers.getContractFactory("AuctionHouse");
    auctionHouse = await Factory.deploy(admin.address, await tContract.getAddress(), 200n); // 2% fee
  });

  it("creates a Dutch auction", async () => {
    const tokenAddr  = await shareToken.getAddress();
    const houseAddr  = await auctionHouse.getAddress();
    await shareToken.connect(seller).approve(houseAddr, ethers.parseEther("100"));

    await auctionHouse.connect(seller).createDutchAuction(
      1, // AssetType.ERC20
      tokenAddr,
      0n,
      ethers.parseEther("100"),
      ethers.parseEther("10"),   // startPrice: 10 ETH
      ethers.parseEther("1"),    // endPrice: 1 ETH
      2n * 60n * 60n,            // 2-hour duration
      "ipfs://test"
    );

    const auction = await auctionHouse.getAuction(1);
    expect(auction.status).to.equal(0n); // OPEN
  });

  it("reports Dutch current price (decreasing)", async () => {
    const priceBefore = await auctionHouse.dutchCurrentPrice(1);
    await time.increase(60 * 60); // 1 hour
    const priceAfter = await auctionHouse.dutchCurrentPrice(1);
    expect(priceAfter).to.be.lt(priceBefore);
  });

  it("creates an English auction", async () => {
    const tokenAddr = await shareToken.getAddress();
    const houseAddr = await auctionHouse.getAddress();
    await shareToken.connect(seller).approve(houseAddr, ethers.parseEther("50"));

    await auctionHouse.connect(seller).createEnglishAuction(
      1, tokenAddr, 0n,
      ethers.parseEther("50"),
      ethers.parseEther("1"),    // reservePrice
      2n * 60n * 60n,
      "ipfs://english"
    );
  });

  it("accepts bids on English auction", async () => {
    await auctionHouse.connect(bidder1).placeBid(2, { value: ethers.parseEther("2") });
    const auction = await auctionHouse.getAuction(2);
    expect(auction.highBid).to.equal(ethers.parseEther("2"));
    expect(auction.highBidder).to.equal(bidder1.address);
  });

  it("higher bid replaces previous bidder", async () => {
    // bidder2 bids higher (must exceed by 1% minimum)
    await auctionHouse.connect(bidder2).placeBid(2, { value: ethers.parseEther("3") });
    const auction = await auctionHouse.getAuction(2);
    expect(auction.highBidder).to.equal(bidder2.address);

    // bidder1 can claim refund
    const pendingRefund = await auctionHouse.pendingRefunds(2, bidder1.address);
    expect(pendingRefund).to.equal(ethers.parseEther("2"));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// LendingProtocol
// ─────────────────────────────────────────────────────────────────────────────

describe("LendingProtocol", () => {
  let lending, shareToken, admin, lender, borrower;

  before(async () => {
    [admin, lender, borrower] = await ethers.getSigners();

    const MockERC20 = await ethers.getContractFactory("DocumentSecurityToken");
    shareToken = await MockERC20.deploy(
      "Lending Share", "LNDSH",
      ethers.keccak256(ethers.toUtf8Bytes("lending-doc")),
      ethers.parseEther("1000000"),
      "US",
      ethers.parseEther("1"),
      admin.address
    );

    await shareToken.setAccreditedInvestor(borrower.address, true);
    await shareToken.transfer(borrower.address, ethers.parseEther("10000"));

    const Treasury = await ethers.getContractFactory("Treasury");
    const tContract = await Treasury.deploy(admin.address, ONE_ETHER, 2n);

    const Factory = await ethers.getContractFactory("LendingProtocol");
    lending = await Factory.deploy(admin.address, await tContract.getAddress(), 1000n);

    // Set share token price: 0.01 ETH per 1e18 tokens
    await lending.connect(admin).updatePrice(
      await shareToken.getAddress(),
      ethers.parseEther("0.01")
    );
  });

  it("lenders can deposit ETH", async () => {
    await lending.connect(lender).deposit({ value: ethers.parseEther("50") });
    expect(await lending.totalDeposits()).to.equal(ethers.parseEther("50"));
  });

  it("borrower can collateralise shares and borrow ETH", async () => {
    const tokenAddr   = await shareToken.getAddress();
    const lendingAddr = await lending.getAddress();

    await shareToken.connect(borrower).approve(lendingAddr, ethers.parseEther("1000"));

    // Collateral value: 1000 shares × 0.01 ETH = 10 ETH
    // Max borrow at 75% LTV: 7.5 ETH
    const borrowBefore = await ethers.provider.getBalance(borrower.address);

    await lending.connect(borrower).borrowAgainstShares(
      tokenAddr,
      ethers.parseEther("1000"),   // collateral
      ethers.parseEther("5")       // borrow 5 ETH (< 7.5 ETH LTV)
    );

    const borrowAfter = await ethers.provider.getBalance(borrower.address);
    // Balance increased by ~5 ETH (minus gas)
    expect(borrowAfter).to.be.gt(borrowBefore);

    const positions = await lending.getBorrowerPositions(borrower.address);
    expect(positions.length).to.equal(1);
  });

  it("borrower can repay and reclaim collateral", async () => {
    const positions = await lending.getBorrowerPositions(borrower.address);
    const posId = positions[0];

    const [principal, interest] = await lending.totalDebt(posId);
    const repayAmount = principal + interest;

    await lending.connect(borrower).repay(posId, { value: repayAmount + ONE_ETHER });

    const position = await lending.getPosition(posId);
    expect(position.active).to.be.false;
  });
});
