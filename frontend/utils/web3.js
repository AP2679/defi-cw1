import { ethers } from 'ethers';
import PokemonCardABI from './PokemonCard.json';
import MarketplaceABI from './PokemonMarketplace.json';
import { POKEMON_CARD_ADDRESS, MARKETPLACE_ADDRESS } from './config';

export const connectWallet = async () => {
  if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
    try {
      // Request wallet connection
      await window.ethereum.request({ method: "eth_requestAccounts" });
      
      // Create a provider and signer
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      return { provider, signer };
    } catch (err) {
      console.error("User rejected connection:", err);
      return null;
    }
  } else {
    alert("Please install MetaMask!");
    return null;
  }
};

export const getContracts = (signer) => {
  const pokemonContract = new ethers.Contract(POKEMON_CARD_ADDRESS, PokemonCardABI.abi, signer);
  const marketContract = new ethers.Contract(MARKETPLACE_ADDRESS, MarketplaceABI.abi, signer);
  
  return { pokemonContract, marketContract };
};