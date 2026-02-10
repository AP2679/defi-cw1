"use client"; // This directive is mandatory for using hooks like useState

import { useState, useEffect } from 'react';
import { connectWallet } from '../utils/web3';
import Link from 'next/link';

export default function Home() {
  const [account, setAccount] = useState(null);

  const handleConnect = async () => {
    const connection = await connectWallet();
    if (connection) {
      // We extract the address from the signer
      const address = await connection.signer.getAddress();
      setAccount(address);
      console.log("Connected to:", address);
    }
  };

  useEffect(() => {
    const checkConnection = async () => {
      if (typeof window !== "undefined" && typeof window.ethereum !== "undefined") {
        const accounts = await window.ethereum.request({ method: "eth_accounts" });
        if (accounts.length > 0) {
          handleConnect();
        }
      }
    };
    checkConnection();
  }, []);

  return (
    <main style={styles.container}>
      {account && (
        <div style={styles.walletBadge}>
          <span style={styles.statusDot}>●</span>
          {account.slice(0, 6)}...{account.slice(-4)}
        </div>
      )}
      <div style={styles.card}>
        <h1 style={styles.title}>Pokemon DeFi Marketplace</h1>
        <p style={styles.description}>
          Trade and Auction rare Pokemon cards on the local testnet.
        </p>
        
        {!account ? (
          <button onClick={handleConnect} style={styles.button}>
            Connect Wallet
          </button>
        ) : null}
        <div style={{ marginTop: '2rem' }}>
            <Link href="/mint">
              <button style={{ 
                  background: 'none', 
                  border: '1px solid #0070f3', 
                  color: '#0070f3', 
                  padding: '10px 20px', 
                  borderRadius: '6px', 
                  cursor: 'pointer' 
              }}>
                Go to Minting Dashboard →
              </button>
            </Link>
        </div>
        <Link href="/market">
              <button style={{...styles.button, margin: '10px'}}>
                Marketplace
              </button>
            </Link>
        <Link href="/dashboard">
          <button style={{...styles.button, margin: '10px'}}>
            Dashboard
          </button>
        </Link>
        <Link href="/swap">
          <button style={{...styles.button, backgroundColor: 'purple'}}>
            Trading Dashboard
          </button>
        </Link>
      </div>
    </main>
  );
}

// Simple internal styles for a clean academic look
const styles = {
  container: { 
    display: 'flex',
    minHeight: '100vh',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', 
    position: 'relative',
    backgroundImage: "url('/flyziken-twitch-bg-pokemon.jpg')",
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundRepeat: 'no-repeat',
    backgroundAttachment: 'fixed',
    minHeight: '100vh'
  },
  card: {
    padding: '2rem',
    backgroundColor: 'white',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    textAlign: 'center',
    maxWidth: '500px',
    width: '100%',
  },
  title: {
    margin: '0 0 1rem 0',
    fontSize: '1.5rem',
    color: '#333',
  },
  description: {
    color: '#666',
    marginBottom: '2rem',
  },
  button: {
    backgroundColor: '#0070f3',
    color: 'white',
    border: 'none',
    padding: '12px 24px',
    borderRadius: '6px',
    cursor: 'pointer',
    fontSize: '1rem',
    fontWeight: 'bold',
  },
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
  statusDot: {
    color: '#10B981',
    fontSize: '10px',
  },
};