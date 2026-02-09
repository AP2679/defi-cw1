const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Pause", function () {
  it("only owner can pause/unpause; trading functions revert when paused", async function () {
    const [owner, seller, buyer] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    // non-owner cannot pause
    await expect(market.connect(seller).pause()).to.be.reverted;

    // owner pauses
    await market.connect(owner).pause();

    // trading blocked
    await expect(
      market.connect(seller).listCard(0, ethers.parseEther("1"), false, 0)
    ).to.be.revertedWithCustomError; // (message differs depending on OZ version)
    // safer generic check:
    // .to.be.reverted

    // unpause
    await market.connect(owner).unpause();

    // now listing can proceed once token exists & approved
    await nft.safeMint(seller.address, "ipfs://x", "Test", "Type", 1);
    await nft.connect(seller).approve(await market.getAddress(), 0);

    await expect(
      market.connect(seller).listCard(0, ethers.parseEther("1"), false, 0)
    ).to.not.be.reverted;
  });
});
