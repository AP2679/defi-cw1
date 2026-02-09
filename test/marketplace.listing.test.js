const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Escrow Listing", function () {

  it("Should transfer NFT to marketplace escrow when listed", async function () {

    const [owner, seller, buyer] = await ethers.getSigners();

    // Deploy NFT contract
    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    // Deploy Marketplace contract
    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // Mint NFT to seller
    await nft.safeMint(
      seller.address,
      "ipfs://test",
      "Charizard",
      "Fire",
      9000
    );

    const tokenId = 0; // first minted token

    // Seller approves marketplace
    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    // Seller lists NFT
    const price = ethers.parseEther("1");

    await market.connect(seller).listCard(
      tokenId,
      price,
      false, // fixed price
      0
    );

    // ✅ Check escrow ownership
    expect(await nft.ownerOf(tokenId)).to.equal(await market.getAddress());

    // ✅ Check listing stored correctly
    const listing = await market.listings(tokenId);

    expect(listing.seller).to.equal(seller.address);
    expect(listing.price).to.equal(price);
    expect(listing.active).to.equal(true);

  });

});
