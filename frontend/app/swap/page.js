"use client";
import { useState, useEffect } from 'react';
import { connectWallet, getContracts } from '../../utils/web3';
import { useRouter } from 'next/navigation';

export default function SwapFeed() {
  const router = useRouter();
  const [swaps, setSwaps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userAddress, setUserAddress] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          loadSwaps();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkConnection();
  }, []);

  // Helper: Fetch details for an array of Token IDs
  const resolveTokenDetails = async (contract, tokenIds) => {
    const details = [];
    for (const id of tokenIds) {
      try {
        const stats = await contract.pokemonDetails(id);
        const uri = await contract.tokenURI(id);
        details.push({
          id: Number(id),
          name: stats.name,
          power: stats.powerLevel.toString(),
          type: stats.element,
          uri: uri
        });
      } catch (e) {
        details.push({ id: Number(id), name: "Unknown", power: "?", type: "?", uri: "" });
      }
    }
    return details;
  };

  const loadSwaps = async () => {
    const connection = await connectWallet();
    if (!connection) return;
    const address = await connection.signer.getAddress();
    setUserAddress(address);

    const { pokemonContract, marketContract } = getContracts(connection.signer);
    
    let counter = 0;
    try {
      counter = await marketContract.swapCounter();
    } catch (err) {
      console.error("Error fetching swap counter. Check contract address/network:", err);
      setLoading(false);
      return;
    }
    const activeSwaps = [];

    // Iterate backwards to show newest first
    for (let i = Number(counter) - 1; i >= 0; i--) {
      try {
        const offer = await marketContract.getSwapOffer(i);
        
        if (offer.active && ((offer.owner.toLowerCase() == address.toLowerCase())||(offer.counterparty.toLowerCase() == address.toLowerCase()) || (offer.counterparty.toLowerCase()== "0x0000000000000000000000000000000000000000"))){
            const offeredIds = Array.from(offer.offeredTokenIds);
            const desiredIds = Array.from(offer.desiredTokenIds);

            const offeredDetails = await resolveTokenDetails(pokemonContract, offeredIds);
            const desiredDetails = await resolveTokenDetails(pokemonContract, desiredIds);

            activeSwaps.push({
                swapId: i,
                owner: offer.owner,
                counterparty: offer.counterparty, // <--- CRITICAL: Must capture this for badges to work
                offeredItems: offeredDetails,
                desiredItems: desiredDetails,
                isMyOffer: offer.owner.toLowerCase() === address.toLowerCase()
            });
        }
      } catch (err) {
        console.warn(`Error loading swap ${i}:`, err);
      }
    }
    setSwaps(activeSwaps);
    setLoading(false);
  };

  const handleAcceptSwap = async (swap) => {
    setStatus("Checking Approvals...");
    try {
        const connection = await connectWallet();
        const { pokemonContract, marketContract } = getContracts(connection.signer);
        const marketAddress = await marketContract.getAddress();

        // Check Approval only if the trade REQUIRES cards from you
        if (swap.desiredItems.length > 0) {
            const isApproved = await pokemonContract.isApprovedForAll(userAddress, marketAddress);
            if (!isApproved) {
                setStatus("Approving Market to trade your cards...");
                const appTx = await pokemonContract.setApprovalForAll(marketAddress, true);
                await appTx.wait();
            }
        }

        setStatus("Confirming Swap on Blockchain...");
        const tx = await marketContract.executeSwap(swap.swapId);
        await tx.wait();
        
        setStatus("Swap Successful!");
        setTimeout(() => {
            setStatus("");
            loadSwaps();
        }, 2000);

    } catch (err) {
        console.error(err);
        setStatus("Failed: " + (err.reason || "Check console. Do you own the required cards?"));
    }
  };

  const handleCancelSwap = async (swapId) => {
    setStatus("Cancelling & Retreiving Items...");
    try {
        const connection = await connectWallet();
        const { marketContract } = getContracts(connection.signer);
        
        const tx = await marketContract.cancelSwap(swapId);
        await tx.wait();
        
        setStatus("Offer Cancelled. Items returned.");
        setTimeout(() => {
            setStatus("");
            loadSwaps();
        }, 2000);
    } catch (err) {
        setStatus("Cancel Failed: " + err.reason);
    }
  };

  const getTradeType = (swap) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    
    if (!swap.counterparty || swap.counterparty === ZERO_ADDRESS) {
        return { label: "🌍 Public Trade", color: "green", bgColor: "#e6ffe6"};
    } else {
        if (swap.counterparty.toLowerCase() === userAddress.toLowerCase()) {
             return { label: "📖 Trade Offer", color: "purple", bgColor: "#f3e5f5" };
        }
        return { label: `📖 Trade Offer (to: ${swap.counterparty.slice(0,6)}...${swap.counterparty.slice(38,42)})`, color: "orange", bgColor: "#fff3e0", alignItems: "center" };
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
        <h1 style={styles.title}>⇄ Active Trade Offers</h1>
        <button onClick={() => router.push('/swap/create')} style={styles.createBtn}>+ Create New Offer</button>
      </div>

      {loading ? <p>Loading Trades...</p> : !userAddress ? (
        <div style={{textAlign: 'center', padding: '2rem'}}>
          <button onClick={loadSwaps} style={styles.createBtn}>Connect Wallet</button>
        </div>
      ) : (
        <div style={styles.list}>
          {swaps.length === 0 && <p>No active trades. Be the first to create one!</p>}
          
          {swaps.map((swap) => {
              const badge = getTradeType(swap);

              return (
                  <div key={swap.swapId} style={{...styles.swapCard, borderLeft: `5px solid ${badge.color}`}}>
                      <div style={styles.swapHeader}>
                          {/* Left Side: ID & Owner */}
                          <div>
                              <strong>Swap #{swap.swapId}</strong>
                              <br/>
                              <span style={{ fontSize: '0.8rem', color: '#666' }}>
                                  {swap.isMyOffer ? "You created this" : `From: ${swap.owner.slice(0,6)}...${swap.owner.slice(38,42)}`}
                              </span>
                          </div>

                          {/* Right Side: The Private/Public Badge */}
                          <div style={{
                              padding: '5px 10px', 
                              borderRadius: '15px', 
                              backgroundColor: badge.bgColor, 
                              color: badge.color,
                              fontWeight: 'bold',
                              fontSize: '0.85rem',
                              border: `1px solid ${badge.color}`
                          }}>
                              {badge.label}
                          </div>
                      </div>

                      <div style={styles.tradeRow}>
                        {/* LEFT: What you GET (Offered) */}
                        <div style={styles.column}>
                          <h4 style={{color: 'green'}}>You Get (Offered)</h4>
                          {swap.offeredItems.length === 0 ? <em>Nothing (Donation request)</em> : (
                              <div style={styles.miniGrid}>
                                {swap.offeredItems.map(item => (
                                    <div key={item.id} style={styles.tokenBadge}>
                                        <div style={styles.miniImagePlaceholder}>
                                           {item.uri && item.uri.includes('http') ? 
                                              <img src={item.uri} alt={item.name} style={styles.img} /> 
                                              : '🐲'}
                                        </div>
                                        <strong>#{item.id}</strong> {item.name}
                                    </div>
                                ))}
                              </div>
                          )}
                        </div>

                        <div style={styles.arrow}>⇄</div>

                        {/* RIGHT: What you GIVE (Desired) */}
                        <div style={styles.column}>
                          <h4 style={{color: 'red'}}>You Give (Desired)</h4>
                          {swap.desiredItems.length === 0 ? <em>Nothing (It's a Gift!)</em> : (
                              <div style={styles.miniGrid}>
                                {swap.desiredItems.map(item => (
                                    <div key={item.id} style={styles.tokenBadge}>
                                        <div style={styles.miniImagePlaceholder}>
                                           {item.uri && item.uri.includes('http') ? 
                                              <img src={item.uri} alt={item.name} style={styles.img} /> 
                                              : '🐲'}
                                        </div>
                                        <strong>#{item.id}</strong> {item.name}
                                    </div>
                                ))}
                              </div>
                          )}
                        </div>
                      </div>

                      <div style={styles.actions}>
                        {swap.isMyOffer ? (
                            <button onClick={() => handleCancelSwap(swap.swapId)} style={styles.cancelBtn}>
                                Cancel & Return Items
                            </button>
                        ) : (
                            <button onClick={() => handleAcceptSwap(swap)} style={styles.acceptBtn}>
                                Accept Trade
                            </button>
                        )}
                      </div>
                  </div>
              );
          })}
        </div>
      )}
      
      {status && <div style={styles.toast}>{status}</div>}
    </div>
  );
}


const styles = {
  container: { padding: '2rem', paddingTop: '80px', fontFamily: 'sans-serif', maxWidth: '1000px', margin: '0 auto', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', color:'#333' },
  title: { fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', textShadow: '4px 4px 4px rgba(0,0,0,0.8)', margin: 0 },
  navBtn: { padding: '8px 16px', cursor: 'pointer', background: '#eee', border: 'none', borderRadius: '4px', color:'#545454'},
  createBtn: { padding: '8px 16px', cursor: 'pointer', background: 'purple', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold' },
  list: { display: 'flex', flexDirection: 'column', gap: '20px' },
  swapCard: { border: '1px solid #ccc', borderRadius: '8px', padding: '1.5rem', background: 'white', boxShadow: '0 2px 5px rgba(0,0,0,0.05)' },
  swapHeader: { display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '10px' },
  tradeRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', marginBottom: '1.5rem' },
  column: { flex: 1, textAlign: 'center' },
  arrow: { fontSize: '2rem', color: '#999', padding: '0 10px' },
  miniGrid: { display: 'flex', flexWrap: 'wrap', gap: '10px', justifyContent: 'center', marginTop: '10px' },
  tokenBadge: { background: '#f0f0f0', padding: '10px', borderRadius: '8px', fontSize: '0.8rem', border: '1px solid #ddd', display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100px' },
  miniImagePlaceholder: { width: '100%', height: '60px', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', marginBottom: '5px', borderRadius: '4px' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  actions: { textAlign: 'right' },
  acceptBtn: { padding: '12px 24px', background: 'green', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' },
  cancelBtn: { padding: '12px 24px', background: '#cc0000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontSize: '1rem' },
  toast: { position: 'fixed', bottom: '20px', right: '20px', background: '#333', color: 'white', padding: '15px', borderRadius: '8px', zIndex: 100 },
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