"use client";

import { useState, useEffect, useCallback } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { fetchUserMint, fetchUserTokenAccount } from "@/utils/constants";

// Convert 16 bytes (little-endian) to u128 BigInt
const bytesToU128LE = (bytes: Uint8Array): bigint => {
  let result = BigInt(0);
  for (let i = 15; i >= 0; i--)
    result = (result << BigInt(8)) | BigInt(bytes[i]);
  return result;
};

const Balance = () => {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<string>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReadBalance = useCallback(async () => {
    if (!connected || !publicKey) {
      setBalance(undefined);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch user's mint
      const mint = await fetchUserMint(connection, publicKey);
      if (!mint) {
        setBalance("No mint found");
        return;
      }

      // Fetch token account for that mint
      const tokenAccount = await fetchUserTokenAccount(
        connection,
        publicKey,
        mint.pubkey
      );
      if (!tokenAccount) {
        setBalance("No token account");
        return;
      }

      // IncoAccount: discriminator(8) + mint(32) + owner(32) + amount(16)
      const handleBytes = tokenAccount.data.slice(72, 88);
      if (handleBytes.every((b) => b === 0)) {
        setBalance("0");
        return;
      }

      const handleStr = bytesToU128LE(handleBytes).toString();
      console.log("Decrypting handle:", handleStr);

      const result = await decrypt([handleStr]);
      console.log("Decrypt result:", result);

      setBalance(result.plaintexts?.[0] ?? "0");
    } catch (err) {
      console.error("Decrypt error:", err);
      setError(err instanceof Error ? err.message : "Failed to decrypt");
      setBalance("0");
    } finally {
      setIsLoading(false);
    }
  }, [connected, publicKey, connection]);

  useEffect(() => {
    if (connected && publicKey) {
      handleReadBalance();
    } else {
      setBalance(undefined);
    }

    const handleMint = () => setTimeout(handleReadBalance, 2000); // Wait for chain
    window.addEventListener("token-minted", handleMint);
    return () => window.removeEventListener("token-minted", handleMint);
  }, [connected, publicKey, handleReadBalance]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Balance:</span>
          <span className="ml-2 font-mono">
            {balance === undefined ? "****" : balance}
          </span>
        </div>
        <button
          onClick={handleReadBalance}
          disabled={isLoading || !connected}
          className="bg-gray-600 text-white py-2 px-4 rounded-full hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? "Decrypting..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Balance;
