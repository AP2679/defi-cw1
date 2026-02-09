const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Cancel Listing", function () {

  it("Seller can cancel listing and NFT returns from escrow", async function () {

    const [owner, seller, buyer] = await ethers.getSigners();

    // Deploy NFT
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    // Deploy Marketplace
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // Mint NFT
    await nft.safeMint(
      seller.address,
      "ipfs://cancel-test",
      "Mewtwo",
      "Psychic",
      10000
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

    // Cancel listing
    await market.connect(seller).cancelListing(tokenId);

    // ✅ NFT returned to seller
    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);

    // ✅ Listing inactive
    const listing = await market.listings(tokenId);
    expect(listing.active).to.equal(false);

  });


  it("Non-seller cannot cancel listing", async function () {

    const [owner, seller, attacker] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    await nft.safeMint(
      seller.address,
      "ipfs://x",
      "Eevee",
      "Normal",
      50
    );

    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    await market.connect(seller).listCard(
      tokenId,
      ethers.parseEther("1"),
      false,
      0
    );

    // ❌ Attacker tries to cancel
    await expect(
      market.connect(attacker).cancelListing(tokenId)
    ).to.be.reverted;

  });

});
