"use client";
import { useState, useEffect } from 'react';
import { connectWallet, getContracts } from '../../utils/web3';
import { ethers } from 'ethers';
import { useRouter } from 'next/navigation';

export default function MarketFeed() {
  const router = useRouter();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAddress, setUserAddress] = useState("");
  
  // Bid Popup State
  const [selectedAuction, setSelectedAuction] = useState(null);
  const [bidAmount, setBidAmount] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          loadListings();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkConnection();
  }, []);

  const loadListings = async () => {
    try {
      const connection = await connectWallet();
      if (!connection) {
        setLoading(false);
        return;
      }
      setUserAddress(await connection.signer.getAddress());

      const { pokemonContract, marketContract } = getContracts(connection.signer);
      const activeListings = [];

      // Scan a range of Token IDs (e.g., 0 to 100)
      for (let i = 0; i < 100; i++) {
        try {
          const listing = await marketContract.listings(i);
          
          // Check if listing is active
          if (listing.active) {
            // Fetch Metadata to show what we are buying
            const stats = await pokemonContract.pokemonDetails(i);
            const uri = await pokemonContract.tokenURI(i);
            
            activeListings.push({
              tokenId: i,
              seller: listing.seller,
              price: ethers.formatEther(listing.price),
              isAuction: listing.isAuction,
              endTime: Number(listing.endTime),
              highestBid: ethers.formatEther(listing.highestBid),
              highestBidder: listing.highestBidder,
              name: stats.name,
              type: stats.element,
              power: stats.powerLevel.toString(),
              uri: uri
            });
          }
        } catch (err) {
          // Token likely doesn't exist or isn't listed
        }
      }
      setListings(activeListings);
    } catch (error) {
      console.error("Error loading listings:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleBuy = async (item) => {
    setStatus("Initiating Purchase...");
    try {
      const connection = await connectWallet();
      const { marketContract } = getContracts(connection.signer);
      
      const priceInWei = ethers.parseEther(item.price);
      
      const tx = await marketContract.buyCard(item.tokenId, { value: priceInWei });
      await tx.wait();
      
      setStatus("Purchase Successful!");
      setTimeout(() => {
          setStatus("");
          loadListings(); // Refresh feed
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("Purchase Failed: " + (err.reason || "See console"));
    }
  };

  const handleBid = async (e) => {
    e.preventDefault();
    if (!selectedAuction) return;
    setStatus("Placing Bid...");

    try {
      const connection = await connectWallet();
      const { marketContract } = getContracts(connection.signer);
      
      const bidInWei = ethers.parseEther(bidAmount);
      
      const tx = await marketContract.bid(selectedAuction.tokenId, { value: bidInWei });
      await tx.wait();
      
      setStatus("Bid Placed Successfully!");
      setTimeout(() => {
          setSelectedAuction(null);
          setStatus("");
          loadListings();
      }, 2000);
    } catch (err) {
      console.error(err);
      setStatus("Bid Failed: " + (err.reason || "Bid must be higher than current"));
    }
  };

  // Helper to check if auction time has passed
  const isAuctionEnded = (endTime) => {
    return Date.now() / 1000 > endTime;
  };

  const handleEndAuction = async (tokenId) => {
    setStatus("Ending Auction...");
    try {
        const connection = await connectWallet();
        const { marketContract } = getContracts(connection.signer);
        const tx = await marketContract.endAuction(tokenId);
        await tx.wait();
        setStatus("Auction Finalized!");
        loadListings();
    } catch (err) {
        setStatus("Error: " + err.reason);
    }
  };

  const handleCancelListing = async (tokenId) => {
    setStatus("Cancelling Listing...");
    try {
      const connection = await connectWallet();
      const { marketContract } = getContracts(connection.signer);
      const tx = await marketContract.cancelListing(tokenId);
      await tx.wait();
      setStatus("Listing Cancelled!");
      loadListings();
    } catch (err) {
      setStatus("Error: " + (err.reason || err.message));
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
        <h1 style={styles.title}>🛒 Market Feed</h1>
        <button onClick={() => router.push('/dashboard')} style={styles.navBtn}>My Collection</button>
      </div>

      {loading ? <p>Loading Market...</p> : !userAddress ? (
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <button onClick={loadListings} style={styles.buyBtn}>Connect Wallet</button>
        </div>
      ) : (
        <div style={styles.grid}>
          {listings.length === 0 ? <p>No items for sale currently.</p> : null}

          {listings.map((item) => (
            <div key={item.tokenId} style={styles.card}>
              <div style={styles.tag}>
                  {item.isAuction ? "🔨 Auction" : "💰 Fixed Price"}
              </div>
              <div style={styles.imagePlaceholder}>
                 {item.uri.includes('http') ? 
                    <img src={item.uri} alt={item.name} style={styles.img} /> 
                    : '🐲'}
              </div>
              <h3>{item.name}</h3>
              <p>{item.type} | Power: {item.power}</p>
              
              <div style={styles.priceBox}>
                {item.isAuction ? (
                    <>
                        <p>Current Bid: {item.highestBid > 0 ? item.highestBid : item.price} ETH</p>
                        <p style={{fontSize: '0.8rem', color: '#666'}}>
                            Ends: {new Date(item.endTime * 1000).toLocaleString()}
                        </p>
                    </>
                ) : (
                    <p>Price: {item.price} ETH</p>
                )}
              </div>

              {/* ACTION BUTTONS */}
              {item.seller.toLowerCase() === userAddress.toLowerCase() ? (
                  !item.isAuction && (
                    <button 
                      onClick={() => handleCancelListing(item.tokenId)} 
                      style={styles.cancelListingBtn}
                    >
                      Cancel Listing
                    </button>
                  )
              ) : (
                  <>
                    {!item.isAuction && (
                        <button onClick={() => handleBuy(item)} style={styles.buyBtn}>Buy Now</button>
                    )}
                    
                    {item.isAuction && !isAuctionEnded(item.endTime) && (
                        <button onClick={() => setSelectedAuction(item)} style={styles.bidBtn}>Place Bid</button>
                    )}
                  </>
              )}

              {/* End Auction Button (Anyone can call if time passed) */}
              {item.isAuction && isAuctionEnded(item.endTime) && (
                  <button onClick={() => handleEndAuction(item.tokenId)} style={styles.endBtn}>
                      Finalize Auction
                  </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Bid Modal */}
      {selectedAuction && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Bid on {selectedAuction.name}</h2>
            <p>Current Highest: {selectedAuction.highestBid} ETH</p>
            <form onSubmit={handleBid}>
                <input 
                    type="number" 
                    step="0.01" 
                    value={bidAmount} 
                    onChange={(e) => setBidAmount(e.target.value)}
                    placeholder="Enter ETH amount"
                    style={styles.input}
                    required
                />
                <div style={styles.modalActions}>
                    <button type="submit" style={styles.confirmBtn}>Submit Bid</button>
                    <button type="button" onClick={() => setSelectedAuction(null)} style={styles.cancelBtn}>Cancel</button>
                </div>
            </form>
          </div>
        </div>
      )}
      
      {status && <div style={styles.toast}>{status}</div>}
    </div>
  );
}

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
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: '2rem', color:'#cacacaff'},
  title: { fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', textShadow: '4px 4px 4px rgba(0,0,0,0.8)', margin: 0 },
  navBtn: { padding: '10px 20px', cursor: 'pointer', background: 'rgba(255, 255, 255, 0.9)', border: 'none', borderRadius: '12px', color: '#333', fontWeight: '600', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', transition: 'transform 0.1s' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '20px' },
  card: { border: '1px solid #ddd', borderRadius: '8px', padding: '1rem', textAlign: 'center', background: 'white', position: 'relative' },
  imagePlaceholder: { height: '150px', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '3rem', marginBottom: '1rem', borderRadius: '4px' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  tag: { position: 'absolute', top: '10px', right: '10px', background: '#f0f0f0', padding: '2px 8px', borderRadius: '10px', fontSize: '0.8rem' },
  priceBox: { background: '#f9f9f9', padding: '10px', margin: '10px 0', borderRadius: '4px' },
  buyBtn: { background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: 'white', border: 'none', padding: '12px', width: '100%', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', marginTop: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  bidBtn: { background: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)', color: 'white', border: 'none', padding: '12px', width: '100%', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', marginTop: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  endBtn: { background: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)', color: 'white', border: 'none', padding: '12px', width: '100%', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', marginTop: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  disabledBtn: { background: '#E5E7EB', color: '#9CA3AF', border: 'none', padding: '12px', width: '100%', borderRadius: '8px', cursor: 'not-allowed', fontWeight: '600', marginTop: '10px' },
  cancelListingBtn: { background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: 'white', border: 'none', padding: '12px', width: '100%', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', marginTop: '10px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  
  // Modal & Toast
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center' },
  modal: { background: 'white', padding: '2rem', borderRadius: '8px', minWidth: '300px' },
  input: { padding: '10px', width: '100%', marginTop: '10px', boxSizing: 'border-box' },
  modalActions: { display: 'flex', gap: '10px', marginTop: '15px' },
  confirmBtn: { flex: 1, padding: '12px', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  cancelBtn: { flex: 1, padding: '12px', background: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '8px', fontWeight: '600', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' },
  toast: { position: 'fixed', bottom: '20px', right: '20px', background: '#333', color: 'white', padding: '15px', borderRadius: '8px' },
  walletBadge: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    backgroundColor: 'white',
    padding: '8px 16px',
    borderRadius: '30px',
    border: '1px solid #eaeaea',
    boxShadow: '0 2px 5px rgba(0,0,0,0.05)',
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