"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { fetchUserMint, fetchUserTokenAccount } from "@/utils/constants";

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
  const hasFetched = useRef(false);

  const handleReadBalance = async () => {
    if (!connected || !publicKey) {
      setBalance(undefined);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const mint = await fetchUserMint(connection, publicKey);
      if (!mint) {
        setBalance("No mint");
        return;
      }

      const tokenAccount = await fetchUserTokenAccount(
        connection,
        publicKey,
        mint.pubkey
      );
      if (!tokenAccount) {
        setBalance("No account");
        return;
      }

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
      console.error("Balance error:", err);
      setError(err instanceof Error ? err.message : "Failed");
      setBalance("0");
    } finally {
      setIsLoading(false);
    }
  };

  // Reset on wallet change
  useEffect(() => {
    hasFetched.current = false;
    setBalance(undefined);
    setError(null);
  }, [publicKey]);

  // Listen for mint events - fetch after delay
  useEffect(() => {
    const onMint = () => setTimeout(handleReadBalance, 3000);
    window.addEventListener("token-minted", onMint);
    return () => window.removeEventListener("token-minted", onMint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey]);

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
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Balance;
