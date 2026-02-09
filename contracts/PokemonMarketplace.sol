// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract PokemonMarketplace is ReentrancyGuard, Ownable, Pausable {

    
    // --- MARKETPLACE STRUCTS & STATE ---
    struct Listing {
        address seller;
        uint256 price;          // Fixed price or Starting bid
        bool isAuction;
        uint256 endTime;        // Only relevant for auctions
        address highestBidder;
        uint256 highestBid;
        bool active;
    }

    IERC721 public nftContract;
    
    // tokenId => Listing details
    mapping(uint256 => Listing) public listings;
    
    // address => amount available to withdraw (Secure Withdrawal Pattern)
    mapping(address => uint256) public pendingWithdrawals;

    // --- SWAP STRUCTS & STATE (Moved to top for standard layout) ---
    struct SwapOffer {
        address owner;
        address counterparty;   // Specific address allowed to accept (address(0) = Public)
        uint256[] offeredTokenIds;
        uint256[] desiredTokenIds;
        bool active;
    }

    mapping(uint256 => SwapOffer) public swapOffers;
    uint256 public swapCounter;

    // --- EVENTS ---
    event ItemListed(uint256 indexed tokenId, address indexed seller, uint256 price, bool isAuction);
    event ItemSold(uint256 indexed tokenId, address indexed buyer, uint256 price);
    event NewBid(uint256 indexed tokenId, address indexed bidder, uint256 amount);
    event AuctionEnded(uint256 indexed tokenId, address indexed winner, uint256 amount);
    event ListingCancelled(uint256 indexed tokenId, address indexed seller);
    
    // Swap Events
    event SwapCreated(uint256 indexed swapId, address indexed owner, address indexed counterparty, uint256[] offeredIds, uint256[] desiredIds);
    event SwapCompleted(uint256 indexed swapId, address indexed responder);
    event SwapCancelled(uint256 indexed swapId);

    constructor(address _nftContract) Ownable(msg.sender) {
    nftContract = IERC721(_nftContract);
}
function pause() external onlyOwner {
    _pause();
}

function unpause() external onlyOwner {
    _unpause();
}



    // ==========================================
    //            STANDARD MARKETPLACE
    // ==========================================

    /**
     * @dev Lists a card for fixed price sale or auction.
     * Transfers the NFT to the contract (Escrow).
     */
    function listCard(uint256 tokenId, uint256 price, bool isAuction, uint256 durationInSeconds) external nonReentrant whenNotPaused() {
        require(price > 0, "Price must be > 0");
        
        // Transfer NFT to marketplace (Escrow)
        nftContract.transferFrom(msg.sender, address(this), tokenId);

        uint256 endTime = isAuction ? block.timestamp + durationInSeconds : 0;

        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            isAuction: isAuction,
            endTime: endTime,
            highestBidder: address(0),
            highestBid: 0,
            active: true
        });

        emit ItemListed(tokenId, msg.sender, price, isAuction);
    }

    /**
     * @dev Buy a fixed-price item.
     */
    function buyCard(uint256 tokenId) external payable nonReentrant whenNotPaused() {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not active");
        require(!listing.isAuction, "Is an auction");
        require(msg.value == listing.price, "Incorrect price");

        listing.active = false;
        
        // Transfer ETH to seller directly
        (bool success, ) = payable(listing.seller).call{value: msg.value}("");
        require(success, "Transfer failed");

        // Transfer NFT to buyer
        nftContract.transferFrom(address(this), msg.sender, tokenId);

        emit ItemSold(tokenId, msg.sender, msg.value);
    }

    /**
     * @dev Place a bid on an auction.
     */
    function bid(uint256 tokenId) external payable nonReentrant whenNotPaused() {
        Listing storage listing = listings[tokenId];
        require(listing.active && listing.isAuction, "Not an active auction");
        require(block.timestamp < listing.endTime, "Auction ended");
        require(msg.value > listing.price && msg.value > listing.highestBid, "Bid too low");

        address previousBidder = listing.highestBidder;
        uint256 previousBid = listing.highestBid;

        // Update state first
        listing.highestBidder = msg.sender;
        listing.highestBid = msg.value;

        // Secure Refund: If there was a previous bidder, add funds to their withdrawable balance
        if (previousBidder != address(0)) {
            (bool success, ) = payable(previousBidder).call{value: previousBid}("");
            if (!success) {
                // Fallback: Store in pendingWithdrawals if transfer fails to prevent DoS
                pendingWithdrawals[previousBidder] += previousBid;
            }
        }

        emit NewBid(tokenId, msg.sender, msg.value);
    }

    /**
     * @dev End an auction and transfer assets.
     */
    function endAuction(uint256 tokenId) external nonReentrant whenNotPaused() {
        Listing storage listing = listings[tokenId];
        require(listing.active && listing.isAuction, "Not active auction");
        require(block.timestamp >= listing.endTime, "Auction ongoing");

        listing.active = false;

        if (listing.highestBidder != address(0)) {
            // Auction success: Seller gets money, Winner gets NFT
            (bool success, ) = payable(listing.seller).call{value: listing.highestBid}("");
            if (!success) {
                pendingWithdrawals[listing.seller] += listing.highestBid;
            }

            nftContract.transferFrom(address(this), listing.highestBidder, tokenId);
            emit AuctionEnded(tokenId, listing.highestBidder, listing.highestBid);
        } else {
            // No bids: NFT returns to seller
            nftContract.transferFrom(address(this), listing.seller, tokenId);
        }
    }

    /**
     * @dev The Secure Withdrawal function.
     */
    function withdraw() external nonReentrant whenNotPaused(){
        uint256 amount = pendingWithdrawals[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingWithdrawals[msg.sender] = 0;

        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");
    }

    /**
     * @dev Cancel a listing and return the NFT to the seller.
     */
    function cancelListing(uint256 tokenId) external nonReentrant whenNotPaused() {
        Listing storage listing = listings[tokenId];
        require(listing.active, "Not active");
        require(listing.seller == msg.sender, "Not seller");

        if (listing.isAuction) {
            require(listing.highestBid == 0, "Cannot cancel auction with bids");
        }

        listing.active = false;
        nftContract.transferFrom(address(this), msg.sender, tokenId);
        emit ListingCancelled(tokenId, msg.sender);
    }

    // ==========================================
    //       MULTI-CARD SWAP & GIFTING
    // ==========================================

    /**
     * @dev Create a swap offer. 
     * @param _counterparty The specific address allowed to accept. Use address(0) for Public.
     */
    function createSwapOffer(
        uint256[] calldata _offeredTokenIds, 
        uint256[] calldata _desiredTokenIds,
        address _counterparty
    ) external nonReentrant whenNotPaused(){
        require(_offeredTokenIds.length > 0 || _desiredTokenIds.length > 0, "Cannot swap nothing for nothing");

        // Escrow the offered cards
        for (uint256 i = 0; i < _offeredTokenIds.length; i++) {
            nftContract.transferFrom(msg.sender, address(this), _offeredTokenIds[i]);
        }

        swapOffers[swapCounter] = SwapOffer({
            owner: msg.sender,
            counterparty: _counterparty,
            offeredTokenIds: _offeredTokenIds,
            desiredTokenIds: _desiredTokenIds,
            active: true
        });

        emit SwapCreated(swapCounter, msg.sender, _counterparty, _offeredTokenIds, _desiredTokenIds);
        swapCounter++;
    }

    /**
     * @dev Accept a swap offer.
     */
    function executeSwap(uint256 swapId) external nonReentrant whenNotPaused(){
        SwapOffer storage offer = swapOffers[swapId];
        require(offer.active, "Swap not active");

        // Check Counterparty restriction
        if (offer.counterparty != address(0)) {
            require(msg.sender == offer.counterparty, "This trade is not for you");
        }

        // 1. Transfer Desired Cards (Responder -> Maker)
        for (uint256 i = 0; i < offer.desiredTokenIds.length; i++) {
            nftContract.transferFrom(msg.sender, offer.owner, offer.desiredTokenIds[i]);
        }

        // 2. Transfer Offered Cards (Escrow -> Responder)
        for (uint256 i = 0; i < offer.offeredTokenIds.length; i++) {
            nftContract.transferFrom(address(this), msg.sender, offer.offeredTokenIds[i]);
        }

        offer.active = false;
        emit SwapCompleted(swapId, msg.sender);
    }
    
    /**
     * @dev Cancel a swap and reclaim escrowed items.
     */
    function cancelSwap(uint256 swapId) external nonReentrant whenNotPaused() {
        SwapOffer storage offer = swapOffers[swapId];
        require(offer.active, "Swap not active");
        require(offer.owner == msg.sender, "Not the offer owner");

        // Refund escrowed cards to the owner
        for (uint256 i = 0; i < offer.offeredTokenIds.length; i++) {
            nftContract.transferFrom(address(this), msg.sender, offer.offeredTokenIds[i]);
        }

        offer.active = false;
        emit SwapCancelled(swapId);
    }

    /**
     * @dev Helper function to fetch full swap details including arrays.
     * Mappings do not return arrays by default, so we need this specific getter.
     */
    function getSwapOffer(uint256 _swapId) external view returns (SwapOffer memory) {
        return swapOffers[_swapId];
    }
}