const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Withdraw (pendingWithdrawals)", function () {
  it("withdraw() reverts if caller has no pending funds", async function () {
    const [owner] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    await expect(market.withdraw()).to.be.revertedWith("No funds to withdraw");
  });

  it("outbid refund fallback credits pendingWithdrawals when previous bidder rejects ETH", async function () {
    const [owner, seller, bidderEOA] = await ethers.getSigners();

    // Deploy NFT + Market
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // Deploy RejectEther bidder contract
    const RejectEther = await ethers.getContractFactory("RejectEther");
    const rejectBidder = await RejectEther.deploy();
    await rejectBidder.waitForDeployment();

    // Mint NFT to seller and list as auction
    await nft.safeMint(seller.address, "ipfs://auction", "Zapdos", "Electric", 5000);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const startingPrice = ethers.parseEther("1");
    const duration = 60; // seconds
    await market.connect(seller).listCard(tokenId, startingPrice, true, duration);

    // First bid from rejecting contract (must be > starting price per contract)
    await rejectBidder.bidOn(await market.getAddress(), tokenId, { value: ethers.parseEther("2") });

    // Second bid from EOA outbids
    await market.connect(bidderEOA).bid(tokenId, { value: ethers.parseEther("3") });

    // Because RejectEther cannot receive refunds, the marketplace should store refund
    const pending = await market.pendingWithdrawals(await rejectBidder.getAddress());
    expect(pending).to.equal(ethers.parseEther("2"));
  });
});
