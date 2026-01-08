"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  Keypair,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  INCO_BASE_PROGRAM_ID,
  PROGRAM_ID,
  INITIALIZE_MINT_DISCRIMINATOR,
  INITIALIZE_ACCOUNT_DISCRIMINATOR,
  MINT_TO_DISCRIMINATOR,
  fetchUserMint,
  fetchUserTokenAccount,
} from "@/utils/constants";

const EncryptedInput = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [mintAddress, setMintAddress] = useState<PublicKey | null>(null);
  const [tokenAccountAddress, setTokenAccountAddress] =
    useState<PublicKey | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's existing mint and token account
  const fetchAccounts = useCallback(async () => {
    if (!connected || !publicKey) {
      setMintAddress(null);
      setTokenAccountAddress(null);
      return;
    }

    setIsLoading(true);
    try {
      // Find user's mint
      const mint = await fetchUserMint(connection, publicKey);
      if (mint) {
        setMintAddress(mint.pubkey);
        // Find token account for this mint
        const tokenAccount = await fetchUserTokenAccount(
          connection,
          publicKey,
          mint.pubkey
        );
        setTokenAccountAddress(tokenAccount?.pubkey ?? null);
      } else {
        setMintAddress(null);
        setTokenAccountAddress(null);
      }
    } catch (err) {
      console.error("Failed to fetch accounts:", err);
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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
    if (!connected || !publicKey || !signTransaction || !encryptedValue) {
      return setError("Missing required data");
    }

    setIsMinting(true);
    setError(null);

    try {
      const tx = new Transaction();
      let currentMint = mintAddress;
      let currentTokenAccount = tokenAccountAddress;
      let mintKp: Keypair | null = null;
      let tokenAccountKp: Keypair | null = null;

      // If no mint exists, create one
      if (!currentMint) {
        mintKp = Keypair.generate();
        currentMint = mintKp.publicKey;

        const initMintData = Buffer.concat([
          Buffer.from(INITIALIZE_MINT_DISCRIMINATOR),
          Buffer.from([9]), // decimals
          publicKey.toBuffer(), // mint_authority
          Buffer.from([1]), // Some(freeze_authority)
          publicKey.toBuffer(), // freeze_authority
        ]);

        tx.add(
          new TransactionInstruction({
            keys: [
              { pubkey: mintKp.publicKey, isSigner: true, isWritable: true },
              { pubkey: publicKey, isSigner: true, isWritable: true },
              {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false,
              },
              {
                pubkey: INCO_BASE_PROGRAM_ID,
                isSigner: false,
                isWritable: false,
              },
            ],
            programId: PROGRAM_ID,
            data: initMintData,
          })
        );
      }

      // If no token account exists, create one
      if (!currentTokenAccount) {
        tokenAccountKp = Keypair.generate();
        currentTokenAccount = tokenAccountKp.publicKey;

        tx.add(
          new TransactionInstruction({
            keys: [
              {
                pubkey: tokenAccountKp.publicKey,
                isSigner: true,
                isWritable: true,
              },
              { pubkey: currentMint, isSigner: false, isWritable: false },
              { pubkey: publicKey, isSigner: false, isWritable: false },
              { pubkey: publicKey, isSigner: true, isWritable: true },
              {
                pubkey: SystemProgram.programId,
                isSigner: false,
                isWritable: false,
              },
              {
                pubkey: INCO_BASE_PROGRAM_ID,
                isSigner: false,
                isWritable: false,
              },
            ],
            programId: PROGRAM_ID,
            data: Buffer.from(INITIALIZE_ACCOUNT_DISCRIMINATOR),
          })
        );
      }

      // Mint tokens
      const ciphertext = Buffer.from(encryptedValue.replace("0x", ""), "hex");
      const mintData = Buffer.concat([
        Buffer.from(MINT_TO_DISCRIMINATOR),
        Buffer.from(new Uint32Array([ciphertext.length]).buffer),
        ciphertext,
        Buffer.from([0]),
      ]);

      tx.add(
        new TransactionInstruction({
          keys: [
            { pubkey: currentMint, isSigner: false, isWritable: true },
            { pubkey: currentTokenAccount, isSigner: false, isWritable: true },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            {
              pubkey: INCO_BASE_PROGRAM_ID,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data: mintData,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      // Sign with new keypairs if created
      const signers = [mintKp, tokenAccountKp].filter(Boolean) as Keypair[];
      if (signers.length > 0) tx.partialSign(...signers);

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction(sig, "confirmed");

      setTxHash(sig);
      setValue("");
      setEncryptedValue("");

      // Refresh accounts
      await fetchAccounts();
      window.dispatchEvent(new CustomEvent("token-minted"));
    } catch (err) {
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
              {mintAddress ? truncate(mintAddress.toBase58()) : "Not created"}
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
                ? truncate(tokenAccountAddress.toBase58())
                : "Not created"}
            </span>
          </div>
          <button
            onClick={fetchAccounts}
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
