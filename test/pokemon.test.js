const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PokemonCard (NFT)", function () {
  it("Owner can mint, tokenURI + pokemonDetails are set", async function () {
    const [owner, alice] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    // Your contract starts token IDs from 0 because _nextTokenId defaults to 0
    const tokenId = 0;

    const uri = "ipfs://example-metadata.json";
    const name = "Pikachu";
    const element = "Electric";
    const powerLevel = 9001;

    await expect(nft.safeMint(alice.address, uri, name, element, powerLevel))
      .to.emit(nft, "CardCreated")
      .withArgs(tokenId, name, powerLevel);

    expect(await nft.ownerOf(tokenId)).to.equal(alice.address);
    expect(await nft.tokenURI(tokenId)).to.equal(uri);

    const details = await nft.pokemonDetails(tokenId);
    expect(details.name).to.equal(name);
    expect(details.element).to.equal(element);
    expect(details.powerLevel).to.equal(powerLevel);
  });

  it("Non-owner cannot mint", async function () {
    const [owner, bob] = await ethers.getSigners();

    const PokemonCard = await ethers.getContractFactory("PokemonCard");
    const nft = await PokemonCard.deploy();
    await nft.waitForDeployment();

    await expect(
      nft.connect(bob).safeMint(bob.address, "ipfs://x", "Bulbasaur", "Grass", 10)
    ).to.be.reverted; // Ownable revert message can vary by OZ version
  });
});
