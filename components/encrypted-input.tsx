"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import { INCO_BASE_PROGRAM_ID, PROGRAM_ID, MINT_DISCRIMINATOR } from "@/utils/constants";

// PDA helpers
const findTokenStatePDA = () => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("token_state")],
    PROGRAM_ID
  );
  return pda;
};

const findBalancePDA = (owner: PublicKey) => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

const EncryptedInput = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState<string>("");
  const [showFullEncrypted, setShowFullEncrypted] = useState(false);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setTxHash(null);
    setEncryptedValue("");
    setError(null);
  };

  const handleEncrypt = async () => {
    if (!value) return;

    setIsEncrypting(true);
    setError(null);
    try {
      const encrypted = await encryptValue(BigInt(value));
      setEncryptedValue(encrypted);
    } catch (err) {
      console.error("Encryption failed:", err);
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleMint = async () => {
    if (!connected || !publicKey || !signTransaction || !encryptedValue) {
      setError("Wallet not connected or no encrypted value");
      return;
    }

    setIsMinting(true);
    setError(null);

    try {
      // Convert encrypted hex string to buffer
      const ciphertext = Buffer.from(encryptedValue.replace("0x", ""), "hex");
      const inputType = 1;

      // Find PDAs
      const tokenStatePDA = findTokenStatePDA();
      const recipientBalancePDA = findBalancePDA(publicKey);

      // Create mint instruction data
      const mintData = Buffer.concat([
        Buffer.from(MINT_DISCRIMINATOR),
        Buffer.from(new Uint32Array([ciphertext.length]).buffer),
        ciphertext,
        Buffer.from([inputType]),
      ]);

      const mintInstruction = new TransactionInstruction({
        keys: [
          { pubkey: tokenStatePDA, isSigner: false, isWritable: true },
          { pubkey: recipientBalancePDA, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: true, isWritable: true },
          { pubkey: publicKey, isSigner: false, isWritable: false }, // recipient = self
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          { pubkey: INCO_BASE_PROGRAM_ID, isSigner: false, isWritable: false },
        ],
        programId: PROGRAM_ID,
        data: mintData,
      });

      const transaction = new Transaction().add(mintInstruction);

      // Get fresh blockhash
      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signedTransaction = await signTransaction(transaction);

      const signature = await connection.sendRawTransaction(
        signedTransaction.serialize(),
        { skipPreflight: false, preflightCommitment: "confirmed" }
      );

      await connection.confirmTransaction(signature, "confirmed");

      setTxHash(signature);
      setValue("");
      setEncryptedValue("");
    } catch (err) {
      console.error("Mint failed:", err);
      setError(err instanceof Error ? err.message : "Failed to mint tokens");
    } finally {
      setIsMinting(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(encryptedValue);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const truncateHash = (hash: string) => {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const getExplorerUrl = (hash: string) => {
    return `https://explorer.solana.com/tx/${hash}?cluster=devnet`;
  };

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Amount to Mint</label>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Enter amount..."
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleChange}
            value={value}
          />
          <button
            onClick={handleEncrypt}
            disabled={isEncrypting || !value || !connected}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isEncrypting ? "Encrypting..." : "Encrypt"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {encryptedValue && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Encrypted Value
          </label>
          <div className="bg-gray-100 p-3 rounded-full border flex items-center justify-between">
            <div className="flex-1 truncate pr-2">
              {showFullEncrypted
                ? encryptedValue
                : truncateHash(encryptedValue)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowFullEncrypted(!showFullEncrypted)}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                {showFullEncrypted ? "Truncate" : "Show Full"}
              </button>
              <button
                onClick={copyToClipboard}
                className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {encryptedValue && (
        <div className="space-y-2">
          <button
            onClick={handleMint}
            disabled={isMinting || !encryptedValue}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isMinting ? "Minting..." : "Mint cUSDC"}
          </button>
        </div>
      )}

      {txHash && (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-sm font-medium text-green-800 mb-1">
              ✅ Minting Successful!
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-green-700 font-mono">
                {truncateHash(txHash)}
              </span>
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-3 py-1 rounded-full text-xs hover:bg-green-700 transition-colors"
              >
                View on Explorer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptedInput;
