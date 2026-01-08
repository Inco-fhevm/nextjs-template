"use client";

import { useState, useEffect, useRef } from "react";
import {
  useWallet,
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { Keypair, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { fetchUserMint, fetchUserTokenAccount } from "@/utils/constants";
import { getProgram } from "@/utils/program";

const EncryptedInput = () => {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const lastFetchedWallet = useRef<string | null>(null);

  const [mintAddress, setMintAddress] = useState<string | null>(null);
  const [tokenAccountAddress, setTokenAccountAddress] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = async () => {
    if (!connected || !publicKey) {
      setMintAddress(null);
      setTokenAccountAddress(null);
      return;
    }

    setIsLoading(true);
    try {
      const mint = await fetchUserMint(connection, publicKey);
      if (mint) {
        setMintAddress(mint.pubkey.toBase58());
        const tokenAccount = await fetchUserTokenAccount(
          connection,
          publicKey,
          mint.pubkey
        );
        setTokenAccountAddress(tokenAccount?.pubkey.toBase58() ?? null);
      } else {
        setMintAddress(null);
        setTokenAccountAddress(null);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const walletKey = publicKey?.toBase58() ?? null;
    if (walletKey !== lastFetchedWallet.current) {
      lastFetchedWallet.current = walletKey;
      if (walletKey) fetchAccounts();
      else {
        setMintAddress(null);
        setTokenAccountAddress(null);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const handleEncrypt = async () => {
    if (!value) return;
    setIsEncrypting(true);
    setError(null);
    try {
      setEncryptedValue(await encryptValue(BigInt(value)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleMint = async () => {
    if (!connected || !publicKey || !wallet || !encryptedValue) {
      return setError("Missing required data");
    }

    setIsMinting(true);
    setError(null);

    try {
      const program = getProgram(connection, wallet);
      const ciphertext = Buffer.from(encryptedValue.replace("0x", ""), "hex");
      const signers: Keypair[] = [];
      const tx = new Transaction();

      let currentMint = mintAddress;
      let currentTokenAccount = tokenAccountAddress;

      // Create mint if needed
      if (!currentMint) {
        const mintKp = Keypair.generate();
        const initMintIx = await program.methods
          .initializeMint(9, publicKey, publicKey)
          .accounts({ mint: mintKp.publicKey, payer: publicKey })
          .instruction();
        tx.add(initMintIx);
        signers.push(mintKp);
        currentMint = mintKp.publicKey.toBase58();
      }

      // Create token account if needed
      if (!currentTokenAccount) {
        const accountKp = Keypair.generate();
        const initAccountIx = await program.methods
          .initializeAccount()
          .accounts({
            account: accountKp.publicKey,
            mint: currentMint,
            owner: publicKey,
            payer: publicKey,
          })
          .instruction();
        tx.add(initAccountIx);
        signers.push(accountKp);
        currentTokenAccount = accountKp.publicKey.toBase58();
      }

      // Mint tokens
      const mintIx = await program.methods
        .mintTo(ciphertext, 0)
        .accounts({
          mint: currentMint,
          account: currentTokenAccount,
          mintAuthority: publicKey,
        })
        .instruction();
      tx.add(mintIx);

      // Send single transaction
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      if (signers.length > 0) {
        tx.partialSign(...signers);
      }

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setMintAddress(currentMint);
      setTokenAccountAddress(currentTokenAccount);
      setTxHash(sig);
      setValue("");
      setEncryptedValue("");
      window.dispatchEvent(new CustomEvent("token-minted"));
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to mint");
    } finally {
      setIsMinting(false);
    }
  };

  const truncate = (s: string) =>
    s.length <= 16 ? s : `${s.slice(0, 6)}...${s.slice(-4)}`;

  const getButtonText = () => {
    if (isMinting) return "Processing...";
    if (!mintAddress && !tokenAccountAddress)
      return "Create Mint & Account, Then Mint";
    if (!tokenAccountAddress) return "Create Account & Mint";
    return "Mint Tokens";
  };

  return (
    <div className="mt-8 space-y-4">
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading accounts...</p>
      ) : (
        <div className="bg-gray-50 border rounded-xl p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Mint:</span>
            <span
              className={`font-mono ${
                mintAddress ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {mintAddress ? truncate(mintAddress) : "Not created"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Token Account:</span>
            <span
              className={`font-mono ${
                tokenAccountAddress ? "text-green-600" : "text-yellow-600"
              }`}
            >
              {tokenAccountAddress
                ? truncate(tokenAccountAddress)
                : "Not created"}
            </span>
          </div>
          <button
            onClick={fetchAccounts}
            disabled={isLoading}
            className="text-blue-500 text-xs underline"
          >
            Refresh
          </button>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium mb-2">Amount to Mint</label>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Enter amount..."
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              setValue(e.target.value);
              setTxHash(null);
              setEncryptedValue("");
              setError(null);
            }}
            value={value}
          />
          <button
            onClick={handleEncrypt}
            disabled={isEncrypting || !value || !connected}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isEncrypting ? "..." : "Encrypt"}
          </button>
        </div>
      </div>

      {encryptedValue && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">
              Encrypted Value
            </label>
            <div className="bg-gray-100 p-3 rounded-full border flex items-center justify-between">
              <span className="text-sm font-mono truncate flex-1">
                {truncate(encryptedValue)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(encryptedValue)}
                className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
          </div>
          <button
            onClick={handleMint}
            disabled={isMinting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {getButtonText()}
          </button>
        </>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {txHash && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm font-medium text-green-800 mb-1">
            ✅ Transaction Successful!
          </p>
          <a
            href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-green-700 underline"
          >
            View on Explorer
          </a>
        </div>
      )}
    </div>
  );
};

export default EncryptedInput;
