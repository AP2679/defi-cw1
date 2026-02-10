"use client";
import { useState, useEffect } from 'react';
import { connectWallet, getContracts } from '../../../utils/web3';
import { useRouter } from 'next/navigation';
import { ethers } from 'ethers';

export default function CreateSwap() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userAddress, setUserAddress] = useState("");
  
  // My Inventory State
  const [myCards, setMyCards] = useState([]);
  const [selectedOffered, setSelectedOffered] = useState([]); 

  // Target / Desired State
  const [counterpartyInput, setCounterpartyInput] = useState(""); 
  const [targetInventory, setTargetInventory] = useState([]);
  const [selectedDesired, setSelectedDesired] = useState([]); // IDs I want
  const [isScanning, setIsScanning] = useState(false);
  
  const [status, setStatus] = useState("");

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          loadMyInventory();
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    checkConnection();
  }, []);

  // 1. Load My Inventory (Left Side)
  const loadMyInventory = async () => {
    const connection = await connectWallet();
    if (!connection) return;
    const address = await connection.signer.getAddress();
    setUserAddress(address);

    const { pokemonContract } = getContracts(connection.signer);
    const foundCards = await scanWalletForCards(pokemonContract, address);
    setMyCards(foundCards);
    setLoading(false);
  };

  // 2. Scan Target Inventory (Right Side)
  const handleScanTarget = async () => {
    let target = counterpartyInput.trim();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    if (target === "0x0") target = ZERO_ADDRESS;

    if (!ethers.isAddress(target)) {
        setStatus("Invalid Ethereum Address");
        return;
    }
    
    setIsScanning(true);
    setStatus("Scanning Target Wallet...");
    setTargetInventory([]); // Clear previous

    try {
        const connection = await connectWallet();
        const { pokemonContract } = getContracts(connection.signer);
        
        // Reuse the helper to scan the target address
        const foundCards = await scanWalletForCards(pokemonContract, target);
        
        setTargetInventory(foundCards);
        setStatus(foundCards.length > 0 ? "Scan Complete." : "This user owns no cards (in range 0-30).");
    } catch (err) {
        console.error(err);
        setStatus("Scan failed.");
    } finally {
        setIsScanning(false);
    }
  };

  // Helper: Scans IDs 0-30 for a specific owner
  const scanWalletForCards = async (contract, ownerAddress) => {
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    const found = [];
    for (let i = 0; i < 100; i++) {
        try {
            const owner = await contract.ownerOf(i);

            const isPublic = ownerAddress === ZERO_ADDRESS;
            const isNotMe = userAddress ? owner.toLowerCase() !== userAddress.toLowerCase() : true;

            if ((isPublic && isNotMe) || (!isPublic && owner.toLowerCase() === ownerAddress.toLowerCase())) {
                const stats = await contract.pokemonDetails(i);
                const uri = await contract.tokenURI(i);
                found.push({
                    id: i,
                    name: stats.name,
                    type: stats.element,
                    power: stats.powerLevel.toString(),
                    uri: uri
                });
            }
        } catch (e) { /* ignore */ }
    }
    return found;
  };

  // Toggle Selection Logic
  const toggleMyCard = (id) => {
    if (selectedOffered.includes(id)) {
      setSelectedOffered(selectedOffered.filter(item => item !== id));
    } else {
      setSelectedOffered([...selectedOffered, id]);
    }
  };

  const toggleTargetCard = (id) => {
    if (selectedDesired.includes(id)) {
      setSelectedDesired(selectedDesired.filter(item => item !== id));
    } else {
      setSelectedDesired([...selectedDesired, id]);
    }
  };

  // Create the Transaction
  const handleCreateSwap = async (e) => {
    e.preventDefault();
    setStatus("Validating Offer...");

    if (selectedOffered.length === 0 && selectedDesired.length === 0) {
      setStatus("Error: Cannot swap nothing for nothing.");
      return;
    }

    // Default to public if no address input, otherwise private
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    let targetAddress = ZERO_ADDRESS;
    let input = counterpartyInput.trim();

    if (input === "0x0") {
        targetAddress = ZERO_ADDRESS;
    } else if (input !== "") {
        if (!ethers.isAddress(input)) {
            setStatus("Error: Invalid Counterparty Address");
            return;
        }
        targetAddress = input;
    }

    try {
      const connection = await connectWallet();
      const { pokemonContract, marketContract } = getContracts(connection.signer);
      const marketAddress = await marketContract.getAddress();

      // Approve if we are giving cards
      if (selectedOffered.length > 0) {
        const isApproved = await pokemonContract.isApprovedForAll(userAddress, marketAddress);
        if (!isApproved) {
            setStatus("Approving Market (Escrow)...");
            const appTx = await pokemonContract.setApprovalForAll(marketAddress, true);
            await appTx.wait();
        }
      }

      setStatus("Creating Swap Offer...");
      
      const tx = await marketContract.createSwapOffer(selectedOffered, selectedDesired, targetAddress);
      
      setStatus("Transaction sent...");
      await tx.wait();

      setStatus("Success! Swap Offer Created.");
      setTimeout(() => router.push('/swap'), 2000);

    } catch (err) {
      console.error(err);
      setStatus("Failed: " + (err.reason || err.message));
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
        <h1 style={styles.title}>Create New Trade</h1>
        <button onClick={() => router.push('/swap')} style={styles.navBtn}>Back to Trades</button>
      </div>

      <div style={styles.layout}>
        
        {/* === LEFT COLUMN: MY CARDS === */}
        <div style={styles.section}>
          <h3 style={{color: 'green'}}>1. You Give (Your Inventory)</h3>
          {loading ? <p>Loading...</p> : !userAddress ? (
            <div style={{textAlign: 'center', padding: '20px'}}>
              <button onClick={loadMyInventory} style={styles.submitBtn}>Connect Wallet</button>
            </div>
          ) : (
            <div style={styles.grid}>
              {myCards.length === 0 && <p>You have no cards.</p>}
              {myCards.map(card => (
                <div 
                  key={card.id} 
                  style={{
                    ...styles.card, 
                    borderColor: selectedOffered.includes(card.id) ? 'green' : '#ddd',
                    backgroundColor: selectedOffered.includes(card.id) ? '#e6ffe6' : 'white'
                  }}
                  onClick={() => toggleMyCard(card.id)}
                >
                  <div style={styles.checkbox}>{selectedOffered.includes(card.id) ? '☑' : '☐'}</div>
                  <div style={styles.imagePlaceholder}>
                     {card.uri && card.uri.includes('http') ? 
                        <img src={card.uri} alt={card.name} style={styles.img} /> 
                        : '🐲'}
                  </div>
                  <h4>#{card.id} {card.name}</h4>
                  <small>{card.power} Power</small>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* === RIGHT COLUMN: THEIR CARDS === */}
        <div style={{...styles.section, background: '#f8f9fa'}}>
          <h3 style={{color: 'purple'}}>2. You Get (Target Inventory)</h3>
          
          <div style={styles.searchBox}>
              <label style={styles.label}>Target Address:</label>
              <div style={{display: 'flex', gap: '10px'}}>
                  <input 
                    type="text" 
                    placeholder="0x... (or 0x0 for Public)" 
                    value={counterpartyInput} 
                    onChange={(e) => setCounterpartyInput(e.target.value)} 
                    style={styles.input}
                  />
                  <button 
                    onClick={handleScanTarget} 
                    disabled={!counterpartyInput}
                    style={styles.scanBtn}
                  >
                    {isScanning ? "Scanning..." : "Scan"}
                  </button>
              </div>
          </div>

          <div style={styles.grid}>
             {/* If not scanned yet, show manual instruction */}
             {targetInventory.length === 0 && !isScanning && (
                 <p style={{color: '#666', fontStyle: 'italic', gridColumn: '1/-1'}}>
                    Enter an address and click Scan to select specific cards.<br/>
                    Or enter 0x0 to scan all cards for a Public trade.
                 </p>
             )}

             {/* The Target Grid */}
             {targetInventory.map(card => (
                <div 
                  key={card.id} 
                  style={{
                    ...styles.card, 
                    borderColor: selectedDesired.includes(card.id) ? 'purple' : '#ddd',
                    backgroundColor: selectedDesired.includes(card.id) ? '#f3e5f5' : 'white'
                  }}
                  onClick={() => toggleTargetCard(card.id)}
                >
                  <div style={{...styles.checkbox, color: 'purple'}}>{selectedDesired.includes(card.id) ? '☑' : '☐'}</div>
                  <div style={styles.imagePlaceholder}>
                     {card.uri && card.uri.includes('http') ? 
                        <img src={card.uri} alt={card.name} style={styles.img} /> 
                        : '🐲'}
                  </div>
                  <h4>#{card.id} {card.name}</h4>
                  <small>{card.power} Power</small>
                </div>
              ))}
          </div>
          
          {/* Manual Override (Hidden but functional via logic) */}
          <div style={styles.summary}>
             <p><strong>Selected to Receive:</strong> {selectedDesired.length > 0 ? selectedDesired.join(", ") : "None (Gift)"}</p>
          </div>
        </div>
      </div>

      {/* === FOOTER ACTION === */}
      <div style={styles.footer}>
        <div style={styles.summaryBox}>
            <p><strong>Offer:</strong> {selectedOffered.length} items</p>
            <p><strong>Request:</strong> {selectedDesired.length} items</p>
            <p><strong>Type:</strong> {counterpartyInput ? "Private" : "Public"}</p>
        </div>
        <button onClick={handleCreateSwap} style={styles.submitBtn}>Create Swap Offer</button>
        <p style={{color: 'blue', marginTop: '10px'}}>{status}</p>
      </div>
    </div>
  );
}

const styles = {
  container: { padding: '2rem', paddingTop: '80px', fontFamily: 'sans-serif', maxWidth: '1200px', margin: '0 auto', position: 'relative' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', color:'#333' },
  title: { fontSize: '2.5rem', fontWeight: 'bold', color: '#ffffff', textShadow: '4px 4px 4px rgba(0,0,0,0.8)', margin: 0 },
  navBtn: { padding: '8px 16px', cursor: 'pointer', background: '#eee', border: 'none', borderRadius: '4px', color:'#545454'},
  layout: { display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '2rem' },
  section: { flex: 1, minWidth: '300px', border: '1px solid #eee', padding: '1rem', borderRadius: '8px' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px', marginTop: '1rem' },
  card: { border: '2px solid #ddd', borderRadius: '8px', padding: '10px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s' },
  checkbox: { fontSize: '1.2rem', marginBottom: '5px', color: 'green' },
  imagePlaceholder: { height: '80px', background: '#f9f9f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem', marginBottom: '0.5rem', borderRadius: '4px' },
  img: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' },
  
  // Search Styles
  searchBox: { background: 'white', padding: '10px', borderRadius: '8px', border: '1px solid #ddd' },
  label: { display: 'block', marginBottom: '5px', fontSize: '0.9rem', fontWeight: 'bold' },
  input: { flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #ccc' },
  scanBtn: { padding: '8px 16px', background: '#333', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' },
  
  // Footer
  footer: { borderTop: '2px solid #eee', paddingTop: '2rem', textAlign: 'center' },
  summaryBox: { display: 'flex', gap: '2rem', justifyContent: 'center', marginBottom: '1rem', color: '#555' },
  submitBtn: { padding: '15px 40px', background: 'purple', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem' },
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