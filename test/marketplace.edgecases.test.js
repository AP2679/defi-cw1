const { expect } = require("chai");
const { ethers, network } = require("hardhat");

describe("PokemonMarketplace - Edge Cases", function () {

  async function deployAll() {
    const [owner, seller, buyer, attacker, bidder1, bidder2] =
      await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
    const market = await PokemonMarketplace.deploy(await nft.getAddress());
    await market.waitForDeployment();

    return { owner, seller, buyer, attacker, bidder1, bidder2, nft, market };
  }

  // =========================
  // LISTING EDGE CASES
  // =========================

  it("listCard: reverts if price == 0", async function () {
    const { seller, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Pika", "Electric", 1);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    await expect(
      market.connect(seller).listCard(tokenId, 0, false, 0)
    ).to.be.revertedWith("Price must be > 0");
  });

  it("listCard: reverts if caller is not owner / not approved", async function () {
    const { seller, attacker, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Pika", "Electric", 1);

    await expect(
      market.connect(attacker).listCard(0, ethers.parseEther("1"), false, 0)
    ).to.be.reverted;
  });

  // =========================
  // BUY EDGE CASES
  // =========================

  it("buyCard: reverts if listing not active", async function () {
    const { buyer, market } = await deployAll();

    await expect(
      market.connect(buyer).buyCard(999, { value: 1n })
    ).to.be.revertedWith("Not active");
  });

  it("buyCard: reverts if auction listing", async function () {
    const { seller, buyer, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Mew", "Psychic", 10);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).listCard(tokenId, ethers.parseEther("1"), true, 60);

    await expect(
      market.connect(buyer).buyCard(tokenId, { value: ethers.parseEther("1") })
    ).to.be.revertedWith("Is an auction");
  });

  it("buyCard: reverts if wrong ETH amount", async function () {
    const { seller, buyer, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Mew", "Psychic", 10);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const price = ethers.parseEther("1");
    await market.connect(seller).listCard(tokenId, price, false, 0);

    await expect(
      market.connect(buyer).buyCard(tokenId, { value: ethers.parseEther("0.5") })
    ).to.be.revertedWith("Incorrect price");
  });

  it("buyCard: cannot buy twice", async function () {
    const { seller, buyer, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Mew", "Psychic", 10);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const price = ethers.parseEther("1");
    await market.connect(seller).listCard(tokenId, price, false, 0);

    await market.connect(buyer).buyCard(tokenId, { value: price });

    await expect(
      market.connect(buyer).buyCard(tokenId, { value: price })
    ).to.be.revertedWith("Not active");
  });

  // =========================
  // AUCTION EDGE CASES
  // =========================

  it("bid: reverts if not auction", async function () {
    const { seller, bidder1, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Eevee", "Normal", 5);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);
    await market.connect(seller).listCard(tokenId, ethers.parseEther("1"), false, 0);

    await expect(
      market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("2") })
    ).to.be.revertedWith("Not an active auction");
  });

  it("bid: enforces increasing bids", async function () {
    const { seller, bidder1, bidder2, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Zapdos", "Electric", 50);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const startPrice = ethers.parseEther("1");
    await market.connect(seller).listCard(tokenId, startPrice, true, 60);

    await expect(
      market.connect(bidder1).bid(tokenId, { value: startPrice })
    ).to.be.revertedWith("Bid too low");

    await market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("2") });

    await expect(
      market.connect(bidder2).bid(tokenId, { value: ethers.parseEther("2") })
    ).to.be.revertedWith("Bid too low");
  });

  // ⭐ PATH A SAFE REFUND TEST
  it("bid: previous highest bidder is refunded (immediate OR pendingWithdrawals fallback)", async function () {
    const { seller, bidder1, bidder2, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Articuno", "Ice", 50);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const startPrice = ethers.parseEther("1");
    await market.connect(seller).listCard(tokenId, startPrice, true, 3600);

    await market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("2") });

    const before = await ethers.provider.getBalance(bidder1.address);

    await market.connect(bidder2).bid(tokenId, { value: ethers.parseEther("3") });

    const pending = await market.pendingWithdrawals(bidder1.address);

    if (pending === ethers.parseEther("2")) {
      expect(pending).to.equal(ethers.parseEther("2"));
    } else {
      const after = await ethers.provider.getBalance(bidder1.address);
      expect(after - before).to.equal(ethers.parseEther("2"));
    }
  });

  // =========================
  // AUCTION FINALIZE
  // =========================

  it("endAuction: cannot end early then succeeds after time", async function () {
    const { seller, bidder1, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Moltres", "Fire", 50);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const duration = 60;
    await market.connect(seller).listCard(tokenId, ethers.parseEther("1"), true, duration);

    await market.connect(bidder1).bid(tokenId, { value: ethers.parseEther("2") });

    await expect(market.endAuction(tokenId)).to.be.revertedWith("Auction ongoing");

    await network.provider.send("evm_increaseTime", [duration + 1]);
    await network.provider.send("evm_mine");

    await market.endAuction(tokenId);

    expect(await nft.ownerOf(tokenId)).to.equal(bidder1.address);
  });

  it("endAuction: no bids returns NFT to seller", async function () {
    const { seller, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Ditto", "Normal", 1);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const duration = 30;
    await market.connect(seller).listCard(tokenId, ethers.parseEther("1"), true, duration);

    await network.provider.send("evm_increaseTime", [duration + 1]);
    await network.provider.send("evm_mine");

    await market.endAuction(tokenId);

    expect(await nft.ownerOf(tokenId)).to.equal(seller.address);
  });

  // =========================
  // WITHDRAW EDGE CASES
  // =========================

  it("withdraw: reverts if no funds", async function () {
    const { buyer, market } = await deployAll();

    await expect(
      market.connect(buyer).withdraw()
    ).to.be.revertedWith("No funds to withdraw");
  });

  // ⭐ PATH A SELLER PAYMENT TEST
  it("fixed-price sale: seller paid immediately; withdraw empty", async function () {
    const { seller, buyer, nft, market } = await deployAll();

    await nft.safeMint(seller.address, "ipfs://x", "Snorlax", "Normal", 99);
    const tokenId = 0;

    await nft.connect(seller).approve(await market.getAddress(), tokenId);

    const price = ethers.parseEther("1");
    await market.connect(seller).listCard(tokenId, price, false, 0);

    const before = await ethers.provider.getBalance(seller.address);

    await market.connect(buyer).buyCard(tokenId, { value: price });

    const after = await ethers.provider.getBalance(seller.address);

    expect(after - before).to.equal(price);
    expect(await market.pendingWithdrawals(seller.address)).to.equal(0n);

    await expect(
      market.connect(seller).withdraw()
    ).to.be.revertedWith("No funds to withdraw");
  });

});
