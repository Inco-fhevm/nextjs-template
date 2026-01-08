"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { Buffer } from "buffer";
import { PROGRAM_ID } from "@/utils/constants";

// PDA helper - matches Rust: seeds = [b"balance", owner.key().as_ref()]
const findBalancePDA = (owner: PublicKey) => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), owner.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

// Convert 16 bytes (little-endian) to u128 BigInt
const bytesToU128LE = (bytes: Uint8Array): bigint => {
  let result = BigInt(0);
  for (let i = 15; i >= 0; i--) {
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  }
  return result;
};

const Balance = () => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();

  const [balance, setBalance] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReadBalance = async () => {
    if (!connected || !publicKey) {
      setError("Wallet not connected");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Get the balance PDA
      const balancePDA = findBalancePDA(publicKey);
      console.log("Balance PDA:", balancePDA.toBase58());

      // Fetch account info from blockchain
      const accountInfo = await connection.getAccountInfo(balancePDA);

      if (!accountInfo || !accountInfo.data) {
        setBalance("0");
        setError("No balance account found. Mint some tokens first.");
        return;
      }

      console.log("Account data length:", accountInfo.data.length);

      // Balance struct: 8 (discriminator) + 32 (owner) + 16 (Euint128/u128 handle)
      if (accountInfo.data.length < 56) {
        setBalance("0");
        return;
      }

      // Extract the Euint128 handle (bytes 40-56, which is 16 bytes for u128)
      const balanceHandleBytes = accountInfo.data.slice(40, 56);
      console.log(
        "Handle bytes (hex):",
        Buffer.from(balanceHandleBytes).toString("hex")
      );

      // Check if handle is all zeros (uninitialized)
      const isZeroHandle = balanceHandleBytes.every((byte) => byte === 0);
      if (isZeroHandle) {
        setBalance("0");
        return;
      }

      // Convert to u128 (little-endian) and then to decimal string
      const handleU128 = bytesToU128LE(balanceHandleBytes);
      const handleDecimal = handleU128.toString();
      console.log("Handle (decimal):", handleDecimal);

      // Decrypt using SDK - pass handle as decimal string
      const result = await decrypt([handleDecimal]);
      console.log("Decrypt result:", result);

      if (result.plaintexts && result.plaintexts.length > 0) {
        const rawAmount = BigInt(result.plaintexts[0]);
        // Convert based on token decimals (9 decimals)
        const decryptedBalance = Number(rawAmount);
        setBalance(decryptedBalance.toString());
      } else {
        setBalance("0");
      }
    } catch (err) {
      console.error("Failed to read balance:", err);
      setError(err instanceof Error ? err.message : "Failed to read balance");
      setBalance("0");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Balance:</span>
          <span className="ml-2 font-mono">{balance ?? "—"} cUSDC</span>
        </div>
        <button
          onClick={handleReadBalance}
          disabled={isLoading || !connected}
          className="bg-gray-600 text-white py-2 px-4 rounded-full hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Balance;
