const { ethers } = require("hardhat");

async function main() {
  console.log("Starting deployment...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // 1. Deploy the NFT Contract (PokemonCard)
  const PokemonCard = await ethers.getContractFactory("PokemonCard");
  const pokemonCard = await PokemonCard.deploy();
  await pokemonCard.waitForDeployment();
  const pokemonCardAddress = await pokemonCard.getAddress();

  console.log(`PokemonCard deployed to: ${pokemonCardAddress}`);

  // Mint 50 NFTs for testing purposes
  console.log("Minting 50 NFTs...");
  
  const pokemons = [
    { name: "Bulbasaur", type: "Grass/Poison" },
    { name: "Ivysaur", type: "Grass/Poison" },
    { name: "Venusaur", type: "Grass/Poison" },
    { name: "Charmander", type: "Fire" },
    { name: "Charmeleon", type: "Fire" },
    { name: "Charizard", type: "Fire/Flying" },
    { name: "Squirtle", type: "Water" },
    { name: "Wartortle", type: "Water" },
    { name: "Blastoise", type: "Water" },
    { name: "Caterpie", type: "Bug" },
    { name: "Metapod", type: "Bug" },
    { name: "Butterfree", type: "Bug/Flying" },
    { name: "Weedle", type: "Bug/Poison" },
    { name: "Kakuna", type: "Bug/Poison" },
    { name: "Beedrill", type: "Bug/Poison" },
    { name: "Pidgey", type: "Normal/Flying" },
    { name: "Pidgeotto", type: "Normal/Flying" },
    { name: "Pidgeot", type: "Normal/Flying" },
    { name: "Rattata", type: "Normal" },
    { name: "Raticate", type: "Normal" },
    { name: "Spearow", type: "Normal/Flying" },
    { name: "Fearow", type: "Normal/Flying" },
    { name: "Ekans", type: "Poison" },
    { name: "Arbok", type: "Poison" },
    { name: "Pikachu", type: "Electric" },
    { name: "Raichu", type: "Electric" },
    { name: "Sandshrew", type: "Ground" },
    { name: "Sandslash", type: "Ground" },
    { name: "Nidoran♀", type: "Poison" },
    { name: "Nidorina", type: "Poison" },
    { name: "Nidoqueen", type: "Poison/Ground" },
    { name: "Nidoran♂", type: "Poison" },
    { name: "Nidorino", type: "Poison" },
    { name: "Nidoking", type: "Poison/Ground" },
    { name: "Clefairy", type: "Fairy" },
    { name: "Clefable", type: "Fairy" },
    { name: "Vulpix", type: "Fire" },
    { name: "Ninetales", type: "Fire" },
    { name: "Jigglypuff", type: "Normal/Fairy" },
    { name: "Wigglytuff", type: "Normal/Fairy" },
    { name: "Zubat", type: "Poison/Flying" },
    { name: "Golbat", type: "Poison/Flying" },
    { name: "Oddish", type: "Grass/Poison" },
    { name: "Gloom", type: "Grass/Poison" },
    { name: "Vileplume", type: "Grass/Poison" },
    { name: "Paras", type: "Bug/Grass" },
    { name: "Parasect", type: "Bug/Grass" },
    { name: "Venonat", type: "Bug/Poison" },
    { name: "Venomoth", type: "Bug/Poison" },
    { name: "Diglett", type: "Ground" }
  ];

  for (const pkm of pokemons) {
    let urlName = pkm.name.toLowerCase();
    // Handle special characters for URL
    if (urlName.includes("♀")) urlName = "nidoran-f";
    if (urlName.includes("♂")) urlName = "nidoran-m";

    const uri = `https://img.pokemondb.net/artwork/large/${urlName}.jpg`;
    const powerLevel = Math.floor(Math.random() * 100) + 1;

    const tx = await pokemonCard.safeMint(deployer.address, uri, pkm.name, pkm.type, powerLevel);
    await tx.wait();
  }
  console.log("Successfully minted 50 NFTs");

  // 2. Deploy the Marketplace (PokemonMarketplace)
  // Pass the NFT address to the constructor to link them
  const PokemonMarketplace = await ethers.getContractFactory("PokemonMarketplace");
  const marketplace = await PokemonMarketplace.deploy(pokemonCardAddress);
  await marketplace.waitForDeployment();
  const marketplaceAddress = await marketplace.getAddress();

  console.log(`PokemonMarketplace deployed to: ${marketplaceAddress}`);

  // 3. Verification
  const linkedAddress = await marketplace.nftContract();
  console.log(`Verification: Marketplace is linked to NFT at ${linkedAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});