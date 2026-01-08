"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { Buffer } from "buffer";
import { PROGRAM_ID } from "@/utils/constants";

const findBalancePDA = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), owner.toBuffer()],
    PROGRAM_ID
  )[0];

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

  const handleReadBalance = async () => {
    if (!connected || !publicKey) return setError("Wallet not connected");

    setIsLoading(true);
    setError(null);

    try {
      const accountInfo = await connection.getAccountInfo(
        findBalancePDA(publicKey)
      );
      if (!accountInfo?.data || accountInfo.data.length < 56) {
        setBalance("0");
        return;
      }

      const handleBytes = accountInfo.data.slice(40, 56);
      if (handleBytes.every((b) => b === 0)) {
        setBalance("0");
        return;
      }

      const result = await decrypt([bytesToU128LE(handleBytes).toString()]);
      setBalance(result.plaintexts?.[0] ?? "0");
    } catch (err) {
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
          <span className="ml-2 font-mono">{balance ?? "****"} cUSDC</span>
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
