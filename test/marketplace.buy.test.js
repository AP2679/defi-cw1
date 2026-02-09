const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Fixed Price Buy", function () {

  it("Buyer should receive NFT and seller should receive ETH", async function () {

    const [owner, seller, buyer] = await ethers.getSigners();

    // Deploy NFT
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    // Deploy Marketplace
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // Mint NFT to seller
    await nft.safeMint(
      seller.address,
      "ipfs://test",
      "Blastoise",
      "Water",
      8000
    );

    const tokenId = 0;

    // Approve marketplace
    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    // List NFT
    const price = ethers.parseEther("1");

    await market.connect(seller).listCard(
      tokenId,
      price,
      false,
      0
    );

    // Track seller balance BEFORE
    const sellerBalanceBefore = await ethers.provider.getBalance(seller.address);

    // Buyer buys NFT
    await market.connect(buyer).buyCard(tokenId, {
      value: price
    });

    // ✅ Buyer now owns NFT
    expect(await nft.ownerOf(tokenId)).to.equal(buyer.address);

    // ✅ Listing inactive
    const listing = await market.listings(tokenId);
    expect(listing.active).to.equal(false);

    // ✅ Seller received ETH (approx check because of gas)
    const sellerBalanceAfter = await ethers.provider.getBalance(seller.address);

    expect(sellerBalanceAfter).to.be.gt(sellerBalanceBefore);

  });

});
