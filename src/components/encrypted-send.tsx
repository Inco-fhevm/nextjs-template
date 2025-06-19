import React, { useState } from "react";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { encryptValue } from "@/utils/inco-lite";
import { parseEther } from "viem";
import { ENCRYPTED_ERC20_CONTRACT_ADDRESS } from "@/utils/contract";

interface EncryptedSendProps {
  refreshBalance: () => Promise<void>;
}

const EncryptedSend = ({ refreshBalance }: EncryptedSendProps) => {
  const { address } = useAccount();
  const [amount, setAmount] = useState("");
  const [receiverAddress, setReceiverAddress] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const send = async () => {
    if (!amount || Number(amount) <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    if (!receiverAddress || !receiverAddress.startsWith("0x")) {
      setError("Please enter a valid receiver address");
      return;
    }

    setError("");
    setIsLoading(true);

    try {
      const parsedAmount = parseEther(amount);
      // Encrypt the value
      const encryptedData = await encryptValue({
        value: parsedAmount,
        address: address as `0x${string}`,
        contractAddress: ENCRYPTED_ERC20_CONTRACT_ADDRESS,
      });

      const hash = await writeContractAsync({
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
                internalType: "bytes",
                name: "encryptedAmount",
                type: "bytes",
              },
            ],
            name: "transfer",
            outputs: [
              {
                internalType: "bool",
                name: "",
                type: "bool",
              },
            ],
            stateMutability: "nonpayable",
            type: "function",
          },
        ],
        functionName: "transfer",
        args: [receiverAddress as `0x${string}`, encryptedData],
      });

      const transaction = await publicClient?.waitForTransactionReceipt({
        hash: hash,
      });

      if (transaction?.status !== "success") {
        throw new Error("Transaction failed");
      }

      setAmount("");
      setReceiverAddress("");
      await refreshBalance();
    } catch (error) {
      console.error("Transaction failed:", error);
      setError(error instanceof Error ? error.message : "Transaction failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full bg-white/5 border border-white/10 p-6 h-full flex flex-col">
      {/* Header Section */}
      <h2 className="text-xl font-medium mb-6">Send Encrypted</h2>

      {/* Input Sections */}
      <div className="space-y-6 mb-6">
        <input
          type="text"
          placeholder="Receiver Address (0x...)"
          value={receiverAddress}
          onChange={(e) => setReceiverAddress(e.target.value)}
          className="w-full p-3 bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-white/30 transition-colors"
          disabled={isLoading}
        />

        <input
          type="number"
          placeholder="Enter Amount to Send"
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
        onClick={send}
        className="w-full p-3 bg-inco-blue text-white hover:bg-inco-blue/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed font-mono"
        disabled={
          !amount || Number(amount) <= 0 || !receiverAddress || isLoading
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
          </div>
        ) : (
          "Send Encrypted"
        )}
      </button>
    </div>
  );
};

export default EncryptedSend;
