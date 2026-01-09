"use client";

import { useState, useEffect } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import {
  fetchUserMint,
  fetchUserTokenAccount,
  extractHandle,
} from "@/utils/constants";

const Balance = () => {
  const { publicKey, connected, signMessage } = useWallet();
  const { connection } = useConnection();
  const [balance, setBalance] = useState<string>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReadBalance = async () => {
    if (!connected || !publicKey || !signMessage) return;

    setLoading(true);
    setError(null);

    try {
      const mint = await fetchUserMint(connection, publicKey);
      if (!mint) return setBalance("No mint");

      const tokenAccount = await fetchUserTokenAccount(
        connection,
        publicKey,
        mint.pubkey
      );
      if (!tokenAccount) return setBalance("No account");

      const handle = extractHandle(tokenAccount.data);
      if (handle === BigInt(0)) return setBalance("0");

      console.log("Decrypting handle:", handle.toString());

      const result = await decrypt([handle.toString()], {
        address: publicKey,
        signMessage,
      });

      const raw = BigInt(result.plaintexts?.[0] ?? "0");
      setBalance((Number(raw) / 1e9).toString());
    } catch (err) {
      console.error("Balance error:", err);
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setBalance(undefined);
    setError(null);
  }, [publicKey]);

  useEffect(() => {
    const onMint = () => setTimeout(handleReadBalance, 3000);
    window.addEventListener("token-minted", onMint);
    return () => window.removeEventListener("token-minted", onMint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, signMessage]);

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Balance:</span>
          <span className="ml-2 font-mono">{balance ?? "****"}</span>
        </div>
        <button
          onClick={handleReadBalance}
          disabled={loading || !connected}
          className="bg-gray-600 text-white py-2 px-4 rounded-full hover:bg-gray-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
};

export default Balance;
