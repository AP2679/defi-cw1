"use client";
import { useState, useEffect } from 'react';
import { connectWallet, getContracts } from '../../utils/web3';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [userAddress, setUserAddress] = useState(null);
  const [myCards, setMyCards] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // State for the "List for Sale" popup
  const [selectedCard, setSelectedCard] = useState(null);
  const [price, setPrice] = useState("");
  const [isAuction, setIsAuction] = useState(false);
  const [duration, setDuration] = useState("3600"); // Default 1 hour
  const [listingStatus, setListingStatus] = useState("");

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          loadMyCollection();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkConnection();
  }, []);

  const loadMyCollection = async () => {
    // 1. Connect
    const connection = await connectWallet();
    if (!connection) {
        setLoading(false);
        return;
    }
    
    const address = await connection.signer.getAddress();
    setUserAddress(address);
    
    const { pokemonContract } = getContracts(connection.signer);

    try {
      // 2. Optimization: Check balance first
      const balance = await pokemonContract.balanceOf(address);
      if (Number(balance) === 0) {
        setMyCards([]);
        setLoading(false);
        return;
      }

      // 3. Scan in parallel
      // We scan a range (0-200). In production, you might want to fetch totalSupply() if available.
      const scanPromises = [];
      for (let i = 0; i < 200; i++) {
        scanPromises.push(
          pokemonContract.ownerOf(i)
            .then(owner => ({ id: i, owner }))
            .catch(() => null) // Ignore non-existent tokens
        );
      }

      const results = await Promise.all(scanPromises);
      const ownedIds = results
        .filter(res => res && res.owner.toLowerCase() === address.toLowerCase())
        .map(res => res.id);

      // 4. Fetch details for owned cards in parallel
      const detailsPromises = ownedIds.map(async (id) => {
        const stats = await pokemonContract.pokemonDetails(id);
        const uri = await pokemonContract.tokenURI(id);
        return {
          id,
          name: stats.name,
          type: stats.element,
          power: stats.powerLevel.toString(),
          uri: uri
        };
      });

      const foundCards = await Promise.all(detailsPromises);
      setMyCards(foundCards);
    } catch (err) {
      console.error("Error loading collection:", err);
    }
    setLoading(false);
  };

  const handleListCard = async (e) => {
    e.preventDefault();
    if (!selectedCard) return;
    setListingStatus("Check your wallet...");

    try {
      const connection = await connectWallet();
      const { pokemonContract, marketContract } = getContracts(connection.signer);
      const marketAddress = await marketContract.getAddress();

      // APPROVE: Check if the market is allowed to move your cards
      const isApproved = await pokemonContract.isApprovedForAll(userAddress, marketAddress);
      
      if (!isApproved) {
        setListingStatus("Approving Marketplace...");
        const approveTx = await pokemonContract.setApprovalForAll(marketAddress, true);
        await approveTx.wait();
      }

      // LIST: Create the sale/auction
      setListingStatus("Confirming Listing...");
      const priceInWei = ethers.parseEther(price);
      const durationInt = parseInt(duration);

      const listTx = await marketContract.listCard(
        selectedCard.id,
        priceInWei,
        isAuction,
        durationInt
      );

      await listTx.wait();
      setListingStatus("Success! Card Listed.");
      
      // Refresh to remove sold card
      setTimeout(() => {
        setSelectedCard(null);
        setListingStatus("");
        loadMyCollection();
      }, 2000);

    } catch (error) {
      console.error(error);
      setListingStatus("Failed: " + (error.reason || "Check console"));
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.appTitle}>Pokemon DeFi Marketplace</div>
      {userAddress && (
        <div style={styles.walletBadge}>
          <span style={styles.statusDot}>●</span>
          {userAddress.slice(0, 6)}...{userAddress.slice(-4)}
        </div>
      )}
      <div style={styles.header}>
        <button onClick={() => router.push('/')} style={styles.navBtn}>← Home</button>
        <h1 style={styles.title}>🏛️ My Collection</h1>
        <button onClick={() => router.push('/market')} style={styles.navBtn}>Marketplace</button>
      </div>

      {loading ? (
        <p>Scanning Blockchain...</p>
      ) : !userAddress ? (
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <button onClick={loadMyCollection} style={styles.listButton}>Connect Wallet</button>
        </div>
      ) : (
        <div style={styles.grid}>
          {myCards.length === 0 ? <p style={{color: '#cacacaff'}}>No cards found. Go to the Marketplace!</p> : null}
          
          {myCards.map((card) => (
            <div key={card.id} style={styles.card}>
              <div style={styles.imagePlaceholder}>
                 {/* Simple logic to render image if valid URL, else emoji */}
                 {card.uri.includes('http') ? 
                    <img src={card.uri} alt={card.name} style={styles.img} /> 
                    : '🐲'}
              </div>
              <h3>{card.name}</h3>
              <p>Type: <strong>{card.type}</strong></p>
              <p>Power: <strong>{card.power}</strong></p>
              
              <button 
                onClick={() => setSelectedCard(card)} 
                style={styles.listButton}
              >
                Sell Card
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Listing Modal */}
      {selectedCard && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>List {selectedCard.name} for Sale</h2>
            
            <form onSubmit={handleListCard} style={styles.form}>
              <label>
                Price (ETH):
                <input 
                  type="number" 
                  step="0.01" 
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)} 
                  required 
                  style={styles.input}
                />
              </label>

              <label>
                <input 
                  type="checkbox" 
                  checked={isAuction} 
                  onChange={(e) => setIsAuction(e.target.checked)} 
                />
                Enable Auction?
              </label>

              {isAuction && (
                 <label>
                   Duration (Seconds):
                   <input 
                     type="number" 
                     value={duration} 
                     onChange={(e) => setDuration(e.target.value)} 
                     style={styles.input}
                   />
                   <small>(3600 = 1 Hour)</small>
                 </label>
              )}

              <div style={styles.modalActions}>
                <button type="submit" style={styles.confirmBtn}>Confirm Listing</button>
                <button 
                  type="button" 
                  onClick={() => setSelectedCard(null)}
                  style={styles.cancelBtn}
                >
                  Cancel
                </button>
              </div>
            </form>
            <p style={{color: 'blue', marginTop: '10px'}}>{listingStatus}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Styling
const styles = {
  container: { 
    padding: '2rem', 
    paddingTop: '80px', 
    fontFamily: 'sans-serif', 
    position: 'relative',
    backgroundImage: "url('/flyziken-twitch-bg-pokemon.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    minHeight: '100vh'
  },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' ,color:'#cacacaff'},
  title: { fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', textShadow: '4px 4px 4px rgba(0,0,0,0.8)', margin: 0 },
  navBtn: { padding: '10px 20px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '12px', color: '#333', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.1s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '20px' },
  card: { border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'white', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  imagePlaceholder: { height: '150px', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', marginBottom: '1rem', borderRadius: '4px' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  listButton: { marginTop: '1rem', padding: '10px 20px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontWeight: '600', width: '100%' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modal: { background: 'white', padding: '2rem', borderRadius: '8px', minWidth: '350px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  form: { display: 'flex', flexDirection: 'column', gap: '1rem' },
  input: { padding: '8px', marginTop: '5px', width: '100%', border: '1px solid #ccc', borderRadius: '4px' },
  modalActions: { display: 'flex', gap: '1rem', marginTop: '1rem' },
  confirmBtn: { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', border: 'none', padding: '12px', flex: 1, cursor: 'pointer', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontWeight: '600' },
  cancelBtn: { background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: 'white', border: 'none', padding: '12px', flex: 1, cursor: 'pointer', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontWeight: '600' },
  walletBadge: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: 'white',
    padding: '8px 16px',
    borderRadius: '30px',
    border: '1px solid #eaeaea',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    fontSize: '0.9rem',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  appTitle: {
    position: 'absolute',
    top: '20px',
    left: '20px',
    backgroundColor: 'white',
    padding: '8px 16px',
    borderRadius: '30px',
    border: '1px solid #eaeaea',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#333',
  },
  statusDot: {
    color: '#10B981',
    fontSize: '10px',
  },
};