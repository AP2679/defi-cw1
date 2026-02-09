const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonMarketplace - Swap System", function () {

  async function deployAll() {
    const [owner, userA, userB, userC] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    return { owner, userA, userB, userC, nft, market };
  }

  // =========================
  // CREATE SWAP TESTS
  // =========================

  it("createSwapOffer: escrows offered NFTs", async function () {
    const { userA, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.safeMint(userA.address, "ipfs://b", "B", "Type", 1);

    await nft.connect(userA).approve(await market.getAddress(), 0);
    await nft.connect(userA).approve(await market.getAddress(), 1);

    await market.connect(userA).createSwapOffer([0,1], [], ethers.ZeroAddress);

    expect(await nft.ownerOf(0)).to.equal(await market.getAddress());
    expect(await nft.ownerOf(1)).to.equal(await market.getAddress());
  });

  it("createSwapOffer: cannot swap nothing for nothing", async function () {
    const { userA, market } = await deployAll();

    await expect(
      market.connect(userA).createSwapOffer([], [], ethers.ZeroAddress)
    ).to.be.revertedWith("Cannot swap nothing for nothing");
  });

  // =========================
  // EXECUTE SWAP TESTS
  // =========================

  it("executeSwap: swaps tokens correctly (public swap)", async function () {
    const { userA, userB, nft, market } = await deployAll();

    // Mint tokens
    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.safeMint(userB.address, "ipfs://b", "B", "Type", 1);

    // Approvals
    await nft.connect(userA).approve(await market.getAddress(), 0);
    await nft.connect(userB).approve(await market.getAddress(), 1);

    // A creates swap: gives token 0, wants token 1
    await market.connect(userA).createSwapOffer([0], [1], ethers.ZeroAddress);

    // B executes swap
    await market.connect(userB).executeSwap(0);

    // Ownership swapped
    expect(await nft.ownerOf(0)).to.equal(userB.address);
    expect(await nft.ownerOf(1)).to.equal(userA.address);
  });

  it("executeSwap: respects counterparty restriction", async function () {
    const { userA, userB, userC, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.safeMint(userB.address, "ipfs://b", "B", "Type", 1);

    await nft.connect(userA).approve(await market.getAddress(), 0);
    await nft.connect(userB).approve(await market.getAddress(), 1);

    // Only userB allowed
    await market.connect(userA).createSwapOffer([0], [1], userB.address);

    // userC should fail
    await expect(
      market.connect(userC).executeSwap(0)
    ).to.be.revertedWith("This trade is not for you");
  });

  it("executeSwap: cannot execute inactive swap", async function () {
    const { userA, userB, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.safeMint(userB.address, "ipfs://b", "B", "Type", 1);

    await nft.connect(userA).approve(await market.getAddress(), 0);
    await nft.connect(userB).approve(await market.getAddress(), 1);

    await market.connect(userA).createSwapOffer([0], [1], ethers.ZeroAddress);
    await market.connect(userB).executeSwap(0);

    await expect(
      market.connect(userB).executeSwap(0)
    ).to.be.revertedWith("Swap not active");
  });

  // =========================
  // CANCEL SWAP TESTS
  // =========================

  it("cancelSwap: returns escrowed NFTs to owner", async function () {
    const { userA, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.connect(userA).approve(await market.getAddress(), 0);

    await market.connect(userA).createSwapOffer([0], [], ethers.ZeroAddress);
    await market.connect(userA).cancelSwap(0);

    expect(await nft.ownerOf(0)).to.equal(userA.address);
  });

  it("cancelSwap: only owner can cancel", async function () {
    const { userA, userB, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.connect(userA).approve(await market.getAddress(), 0);

    await market.connect(userA).createSwapOffer([0], [], ethers.ZeroAddress);

    await expect(
      market.connect(userB).cancelSwap(0)
    ).to.be.revertedWith("Not the offer owner");
  });

  it("cancelSwap: cannot cancel inactive swap", async function () {
    const { userA, userB, nft, market } = await deployAll();

    await nft.safeMint(userA.address, "ipfs://a", "A", "Type", 1);
    await nft.safeMint(userB.address, "ipfs://b", "B", "Type", 1);

    await nft.connect(userA).approve(await market.getAddress(), 0);
    await nft.connect(userB).approve(await market.getAddress(), 1);

    await market.connect(userA).createSwapOffer([0], [1], ethers.ZeroAddress);
    await market.connect(userB).executeSwap(0);

    await expect(
      market.connect(userA).cancelSwap(0)
    ).to.be.revertedWith("Swap not active");
  });

});
