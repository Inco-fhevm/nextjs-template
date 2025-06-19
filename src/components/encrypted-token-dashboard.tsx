import React, { useState } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { formatEther, WalletClient } from "viem";
import { ENCRYPTED_ERC20_CONTRACT_ADDRESS } from "@/utils/contract";
import { reEncryptValue } from "@/utils/inco-lite";
import EncryptedTokenInterface from "./encrypted-token-interface";
import EncryptedSend from "./encrypted-send";

const EncryptedTokenDashboard = () => {
  const [encryptedBalance, setEncryptedBalance] = useState(0);
  const [isEncryptedLoading, setIsEncryptedLoading] = useState(false);
  const [error, setError] = useState("");

  const publicClient = usePublicClient();
  const walletClient = useWalletClient();
  const { address } = useAccount();

  const refreshBalance = async () => {
    try {
      setIsEncryptedLoading(true);
      setError("");
      const balanceHandle = await publicClient?.readContract({
        address: ENCRYPTED_ERC20_CONTRACT_ADDRESS,
        abi: [
          {
            inputs: [
              {
                internalType: "address",
                name: "wallet",
                type: "address",
              },
            ],
            name: "balanceOf",
            outputs: [
              {
                internalType: "euint256",
                name: "",
                type: "bytes32",
              },
            ],
            stateMutability: "view",
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [address as `0x${string}`],
      });

      if (
        balanceHandle?.toString() ===
        "0x0000000000000000000000000000000000000000000000000000000000000000"
      ) {
        setEncryptedBalance(0);
        return;
      }

      const decrypted = await reEncryptValue({
        walletClient: walletClient.data as WalletClient,
        handle: balanceHandle?.toString() as string,
      });
      const formattedDecrypted = formatEther(decrypted as bigint);
      setEncryptedBalance(Number(formattedDecrypted));
    } catch (err) {
      console.error("Error refreshing balance:", err);
      setError("Failed to refresh balance");
    } finally {
      setIsEncryptedLoading(false);
    }
  };

  return (
    <div className="md:grid md:grid-cols-2 md:gap-8">
      <EncryptedTokenInterface
        encryptedBalance={encryptedBalance}
        isEncryptedLoading={isEncryptedLoading}
        error={error}
        refreshBalance={refreshBalance}
      />
      <EncryptedSend refreshBalance={refreshBalance} />
    </div>
  );
};

export default EncryptedTokenDashboard;
