import React, { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { ENCRYPTED_ERC20_CONTRACT_ADDRESS } from "@/utils/contract";

interface EncryptedTokenInterfaceProps {
  encryptedBalance: number;
  isEncryptedLoading: boolean;
  error: string;
  refreshBalance: () => Promise<void>;
}

const EncryptedTokenInterface = ({
  encryptedBalance,
  isEncryptedLoading,
  error,
  refreshBalance,
}: EncryptedTokenInterfaceProps) => {
  const [amount, setAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { address } = useAccount();

  const mintcUSDC = async () => {
    try {
      const cUSDCMintTxHash = await writeContractAsync({
        address: ENCRYPTED_ERC20_CONTRACT_ADDRESS,
        abi: [
          {
            inputs: [
              {
                internalType: "address",
                name: "to",
                type: "address",
              },
              {
                internalType: "uint256",
                name: "mintedAmount",
                type: "uint256",
              },
            ],
            name: "mint",
            outputs: [],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "mint",
        args: [address as `0x${string}`, parseEther(amount.toString())],
      });

      const tx = await publicClient?.waitForTransactionReceipt({
        hash: cUSDCMintTxHash,
      });

      if (tx?.status !== "success") {
        throw new Error("Transaction failed");
      }
    } catch (err) {
      console.error("Error minting cUSDC:", err);
      throw new Error("Failed to mint cUSDC");
    }
  };

  const handleMint = async () => {
    if (!amount || Number(amount) <= 0) {
      return;
    }

    try {
      setIsLoading(true);
      await mintcUSDC();
      setAmount("");
      await refreshBalance();
    } catch (err) {
      console.error("Error minting cUSDC:", err);
      throw new Error("Failed to mint cUSDC");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-white/5 border border-white/10 p-6 h-full flex flex-col">
      {/* Header Section */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-medium">Encrypted Tokens</h2>
        <button
          onClick={refreshBalance}
          className="flex items-center gap-2 hover:bg-white/10 transition-colors text-sm px-2 py-1"
          disabled={isEncryptedLoading}
        >
          <span className="text-white/60">Refresh</span>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`text-white ${isEncryptedLoading ? "animate-spin" : ""}`}
          >
            <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
            <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
            <path d="M3 21v-5h5" />
          </svg>
        </button>
      </div>

      {/* Balance Section */}
      <div className="bg-white/5 border border-white/10 p-3 mb-6">
        <div className="flex items-center justify-between">
          <span className="text-white/60">Encrypted Balance</span>
          <div className="flex items-center gap-2">
            {isEncryptedLoading ? (
              <span className="text-white/40">Loading...</span>
            ) : (
              <span className="font-medium font-mono">
                {encryptedBalance || "0.00"} cUSDC
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Input Section */}
      <div className="mb-6">
        <input
          type="number"
          placeholder="Enter Amount to Mint"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-full p-3 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
          disabled={isLoading}
        />
      </div>

      {/* Error Section */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 text-sm mb-4">
          {error}
        </div>
      )}

      {/* Spacer to push button to bottom */}
      <div className="flex-1"></div>

      {/* Action Button - Always at bottom */}
      <button
        onClick={handleMint}
        className="w-full p-3 bg-inco-blue text-white hover:bg-inco-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
        disabled={!amount || Number(amount) <= 0 || isLoading}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : (
          "Mint cUSDC"
        )}
      </button>
    </div>
  );
};

export default EncryptedTokenInterface;
