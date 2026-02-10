"use client";
import { useState } from 'react';
import { connectWallet, getContracts } from '../../utils/web3';
import { useRouter } from 'next/navigation';

const POKEMON_TYPES = [
  "Normal", "Fire", "Water", "Grass", "Electric", "Ice", "Fighting", "Poison", "Ground",
  "Flying", "Psychic", "Bug", "Rock", "Ghost", "Dragon", "Steel", "Dark", "Fairy"
];

export default function MintPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [selectedTypes, setSelectedTypes] = useState([]);
  
  // Form State
  const [formData, setFormData] = useState({
    name: '',
    powerLevel: '',
    imageURI: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleTypeToggle = (type) => {
    if (selectedTypes.includes(type)) {
      setSelectedTypes(selectedTypes.filter(t => t !== type));
    } else {
      if (selectedTypes.length < 2) {
        setSelectedTypes([...selectedTypes, type]);
      }
    }
  };

  const handleMint = async (e) => {
    e.preventDefault();
    
    if (selectedTypes.length === 0) {
      setStatus("Error: Please select at least one type.");
      return;
    }

    setLoading(true);
    setStatus("Initiating transaction...");
    console.log("🔵 MINT DEBUG: Starting process...");

    try {
      // 1. Connection Check
      const connection = await connectWallet();
      if (!connection) {
        console.error("🔴 MINT DEBUG: Wallet connection failed or rejected.");
        setStatus("Wallet connection failed.");
        return;
      }

      const { pokemonContract } = getContracts(connection.signer);
      const userAddress = await connection.signer.getAddress();
      
      console.log("👤 MINT DEBUG: User Address:", userAddress);
      
      // 2. Owner Check (Crucial for debugging 'onlyOwner' errors)
      try {
          const owner = await pokemonContract.owner();
          console.log("👑 MINT DEBUG: Contract Owner:", owner);
          
          if (userAddress.toLowerCase() !== owner.toLowerCase()) {
              console.warn("⚠️ MINT DEBUG: MISMATCH! You are not the owner.");
              setStatus("Error: You must use the Deployer Account (Account #0)");
              setLoading(false);
              return;
          }
      } catch (ownerErr) {
          console.warn("⚠️ MINT DEBUG: Could not fetch owner (Contract might be wrong address)", ownerErr);
      }

      // 3. Prepare Data
      const powerInt = parseInt(formData.powerLevel);
      const typeString = selectedTypes.join('/');
      console.log("📦 MINT DEBUG: Payload:", {
          to: userAddress,
          uri: formData.imageURI,
          name: formData.name,
          type: typeString,
          power: powerInt
      });

      // 4. Send Transaction
      console.log("🚀 MINT DEBUG: Sending transaction...");
      const tx = await pokemonContract.safeMint(
        userAddress,           
        formData.imageURI,     
        formData.name,         
        typeString,         
        powerInt               
      );

      console.log("⏳ MINT DEBUG: Transaction Hash:", tx.hash);
      setStatus("Transaction sent! Waiting for confirmation...");
      
      // 5. Wait for Receipt
      const receipt = await tx.wait();
      console.log("✅ MINT DEBUG: Transaction Confirmed!", receipt);
      
      setStatus("Success! Pokemon Minted.");
      setTimeout(() => setStatus(""), 5000);
      
      // Clear form
      setFormData({ name: '', powerLevel: '', imageURI: '' });
      setSelectedTypes([]);

    } catch (error) {
      console.error("🔴 MINT DEBUG: Critical Error:", error);
      
      if (error.code === 'ACTION_REJECTED') {
        setStatus("Transaction rejected by user.");
      } else if (error.message && error.message.includes("OwnableUnauthorizedAccount")) {
        setStatus("Error: Only the Contract Owner (Account #0) can mint.");
      } else if (error.reason) {
         // This captures Solidity revert strings
        setStatus(`Transaction Failed: ${error.reason}`);
      } else {
        setStatus("Transaction failed. Check console for details.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <button onClick={() => router.push('/')} style={styles.backButton}>← Back to Landing</button>
        <h1 style={styles.title}>Mint New Pokémon</h1>
        <p>IMPORTANT: Only the Contract Owner can mint</p>
        
        <form onSubmit={handleMint} style={styles.form}>
          <div style={styles.group}>
            <label style={styles.label}>Name</label>
            <input 
              name="name" 
              value={formData.name} 
              onChange={handleChange} 
              placeholder="e.g. Charizard" 
              required 
              style={styles.input}
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Type</label>
            <div style={styles.typeGrid}>
              {POKEMON_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeToggle(type)}
                  style={selectedTypes.includes(type) ? styles.typeBtnSelected : styles.typeBtn}
                >
                  {type}
                </button>
              ))}
            </div>
            <small style={{color: '#666', marginTop: '5px'}}>Selected: {selectedTypes.join('/') || 'None'} (Max 2)</small>
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Power Level</label>
            <input 
              name="powerLevel" 
              type="number" 
              value={formData.powerLevel} 
              onChange={handleChange} 
              placeholder="e.g. 90" 
              required 
              style={styles.input}
            />
          </div>

          <div style={styles.group}>
            <label style={styles.label}>Image URI (or IPFS Hash)</label>
            <input 
              name="imageURI" 
              value={formData.imageURI} 
              onChange={handleChange} 
              placeholder="ipfs://... or https://..." 
              required 
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={loading} style={styles.button}>
            {loading ? "Minting..." : "Mint Card"}
          </button>
        </form>

        {status && <p style={styles.status}>{status}</p>}
      </div>
    </div>
  );
}

// Consistent styling
const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, sans-serif',
    backgroundImage: "url('/flyziken-twitch-bg-pokemon.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
  },
  card: {
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    width: '100%',
    maxWidth: '500px',
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: '#0070f3',
    cursor: 'pointer',
    marginBottom: '1rem',
    fontSize: '0.9rem',
  },
  title: {
    margin: '0 0 1.5rem 0',
    fontSize: '1.5rem',
    color: '#333',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  group: {
    display: 'flex',
    flexDirection: 'column',
    textAlign: 'left',
  },
  label: {
    marginBottom: '0.5rem',
    color: '#666',
    fontSize: '0.9rem',
  },
  input: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid #ddd',
    fontSize: '1rem',
    color: '#333',
    width: '100%',
  },
  button: {
    marginTop: '1rem',
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    padding: '12px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
  status: {
    marginTop: '1rem',
    textAlign: 'center',
    color: '#0070f3',
    fontSize: '0.9rem',
  },
  typeGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
    gap: '8px',
  },
  typeBtn: {
    padding: '8px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    background: '#f9f9f9',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
  typeBtnSelected: {
    padding: '8px',
    border: '1px solid #0070f3',
    borderRadius: '4px',
    background: '#0070f3',
    color: 'white',
    cursor: 'pointer',
    fontSize: '0.8rem',
  },
};