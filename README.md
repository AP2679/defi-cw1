# Decentralized Pokemon Card NFT Project
This project is a Decentralized Application (dApp) deployed on a local Hardhat testnet, using the Ethereum ERC721 contract standard.
The frontend for this project is implemented through `next.js`, a react-based framework.



## Overview of Terminal Scripts:

### Initial setup:
1. Delete the following folders *if they exist*: `node_modules`, `frontend/node_modules`

2. Then, run the following commands (as needed):
```console
// in root
$ npm install
$ npx hardhat compile // if needed

// in frontend
$ cd frontend
$ npm install
$ npm run build // if needed
```

### Running the application:
```console
// in root - deploy the node
$ npx hardhat node

// in a separate root terminal - run deployment script
$ npx hardhat run scripts/deploy.js --network localhost

// in a separate root terminal - switch to frontend folder, and run a dev frontend server
$ cd frontend
$ npm run dev
```

### Kill process (if needed)
```console
$ lsof -iTCP:8545 -sTCP:LISTEN

$ kill -9 {pid}
```

for example;
```console
pascal@... DeFi_cw % lsof -iTCP:8545 -sTCP:LISTEN                    
COMMAND   PID   USER   FD   TYPE          DEVICE SIZE/OFF NODE NAME
node    69494 pascal   ...  IPv4             ... 0t0  TCP localhost:8545 (LISTEN)
pascal@... DeFi_cw % kill -9 69494   
```
### Run testing scripts:
```console
npx hardhat test
```


## Set up MetaMask Wallet:

Login, or Create a user account.

In accounts page, to set up a test account:
- Go to 'add wallet'
- Click: 'Import an account'
- Copy a private key from the node initialisation `npx hardhat node`.

*Note: it’s best to set up two accounts, the contract owner (address 0) and a test account (address 1-19).*

### To set up the RPC network:

1. From the main page click:

<img src="images/main.png" alt="main_page" width="200"/>

2. click 'Custom'
3. click 'Add custom network'
4. Fill in network details:
    - **Network name**: [any name]
    - **Default RPC URL**: http://127.0.0.1:8545
    - **Chain ID**: 31337
    - **Currency symbol**: ETH

<img src="images/edit_network.png" alt="main_page" width="200"/>

### Etc.

If any issues with nonce:

- Go to ≡ -> Settings -> Advanced:

<img src="images/advanced.png" alt="main_page" width="200"/>

OR

- use **Rabby** instead which allows you to set the nonce more granularly.

## Overall Project Architecture

<img src="images/architecture.png" alt="main_page" width="400"/>

tbd

## Smart Contracts
tbd


## Testing
tbd


## Security Considerations
tbd

- **Marketplace**:
    - For auctions, to prevent malicious bidding, all bids must be non-retractable.
    - When an auction is completed (when the time limit expires), any address may finalise the auction, this is to prevent a malicious owner from burning the transaction by never finalising it.
    - When finalised, all ETH is returned to the failed bidders, while the winner’s ETH is transferred to the auction owner.

- **Swaps**:
    - *private* trading is not actually private, all transactions are published onto the blockchain, tx’s just don’t get shown to users if they are not relevant.
    - Trades can be *public*, meaning that an advertisement for a requested card in return of another card(s), or none at all, is broadcasted onto the swap page.

## Frontend Design

The frontend application has *6 pages* within `frontend/app/`:
- **Landing Page** (`page.js`): The welcoming page that introduces the Pokemon Card NFT project, takes you to its features (mint, marketplace,trading, view dashboard), and allows connection to *MetaMask*.

- **Mint** (`mint/page.js`): A dedicated page for creating new Pokemon Card NFTs. The contract owner can access this functionality to mint new cards with specific attributes like name, element, and power level. Currently the page is accessible by any user, but only the contract owner may use it to mint new cards.

- **Marketplace** (`market/page.js`): The central hub for users to browse listed cards, buy available cards for a fixed price, or participate in auctions by placing bids.

- **Dashboard** (`dashboard/page.js`): Users can view their collection of Pokemon cards, and initialise an auction/listing on an owned card.

- **Swap** (`swap/page.js`): This page displays a feed of all active trade proposals. It shows public offers available to anyone, as well as private offers directed specifically to the connected user.

- **Create (Swap)** (`swap/create/page.js`): A form where users can propose a new trade. They can select which of their cards they want to offer and which cards they desire in return. They can make the offer public or direct it to a specific user's address.

Within `frontend/utils/`, all pages interact with `config.js` to retrieve `POKEMON_CARD_ADDRESS` and `MARKETPLACE_ADDRESS` constants,
along with `PokemonCard.json` and `Marketplace.json` ABI files, which are all manually configured and retrieved from the hardhat compilation.

*\*background image credit: https://www.artstation.com/artwork/1xAyZ8*

*\*card images credit: https://pokemondb.net/*

## Contribution
tbd

## Use of GenAI
tbd