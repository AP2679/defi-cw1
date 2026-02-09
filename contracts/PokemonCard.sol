// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PokemonCard is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // Struct to store comprehensive metadata on-chain as required 
    struct PokemonStats {
        string name;
        string element; // e.g., Fire, Water
        uint256 powerLevel;
    }

    // Mapping from tokenId to Pokemon stats
    mapping(uint256 => PokemonStats) public pokemonDetails;

    // Event emitted upon new card creation for frontend event listeners [cite: 18]
    event CardCreated(uint256 indexed tokenId, string name, uint256 powerLevel);

    constructor() ERC721("PokemonCard", "PKM") Ownable(msg.sender) {}

    /**
     * @dev Mints a new Pokemon card.
     * Implements secure minting with access control (onlyOwner).
     * @param to The address that will receive the minted card.
     * @param tokenURI The metadata URI (IPFS or server URL).
     * @param name Name of the Pokemon.
     * @param element Elemental type.
     * @param powerLevel Power level value.
     */
    function safeMint(
        address to,
        string memory tokenURI,
        string memory name,
        string memory element,
        uint256 powerLevel
    ) public onlyOwner {
        uint256 tokenId = _nextTokenId++;
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, tokenURI);

        // Store specific characteristics on-chain
        pokemonDetails[tokenId] = PokemonStats(name, element, powerLevel);

        emit CardCreated(tokenId, name, powerLevel);
    }

    // The following function overrides are required by Solidity.
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}