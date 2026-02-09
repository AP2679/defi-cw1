const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Auction Bidding", function () {
  it("Enforces min/increasing bids and ensures previous bidder is refunded (withdraw or immediate)", async function () {
    const [owner, seller, bidder1, bidder2] = await ethers.getSigners();

    // Deploy NFT
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    // Deploy Marketplace
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // Mint NFT to seller
    await nft.safeMint(seller.address, "ipfs://auction", "Articuno", "Ice", 4000);
    const tokenId = 0;

    // Approve + list auction
    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    const startPrice = ethers.parseEther("1");

    await market.connect(seller).listCard(tokenId, startPrice, true, 3600);

    // ❌ Bid below minimum should revert
    await expect(
      market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("0.5") })
    ).to.be.reverted;

    // ✅ First bid
    await market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("2") });

    const listing1 = await market.listings(tokenId);
    expect(listing1.highestBidder).to.equal(bidder1.address);
    expect(listing1.highestBid).to.equal(ethers.parseEther("2"));

    // Record bidder1 balance before being outbid (they won't pay gas for bidder2 tx)
    const bidder1BalBeforeOutbid = await ethers.provider.getBalance(bidder1.address);

    // ❌ Lower bid should revert
    await expect(
      market.connect(bidder2).bid(tokenId, { value: ethers.parseEther("1.5") })
    ).to.be.reverted;

    // ✅ Outbidding bid
    await market.connect(bidder2).bid(tokenId, { value: ethers.parseEther("3") });

    const listing2 = await market.listings(tokenId);
    expect(listing2.highestBidder).to.equal(bidder2.address);
    expect(listing2.highestBid).to.equal(ethers.parseEther("3"));

    // ✅ Previous bidder refund check (supports both models)
    const pending = await market.pendingWithdrawals(bidder1.address);

    if (pending === ethers.parseEther("2")) {
      // Withdraw-pattern refund
      expect(pending).to.equal(ethers.parseEther("2"));
    } else {
      // Immediate refund model: bidder1 wallet balance should increase by ~2 ETH
      const bidder1BalAfterOutbid = await ethers.provider.getBalance(bidder1.address);
      expect(bidder1BalAfterOutbid - bidder1BalBeforeOutbid).to.equal(ethers.parseEther("2"));
    }
  });
});
