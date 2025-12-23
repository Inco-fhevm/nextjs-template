import { CERC_ABI, CERC_CONTRACT_ADDRESS } from "@/utils/constants";
import { decryptValue } from "@/utils/inco";
import React, { useState } from "react";
import { formatEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

const Balance = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();
  const [balance, setBalance] = useState<string | undefined>(undefined);
  const readBalanceHandle = async () => {
    if (!address) return;
    if (!publicClient) return;
    const balance = await publicClient.readContract({
      address: CERC_CONTRACT_ADDRESS,
      abi: CERC_ABI,
      functionName: "balanceOf",
      args: [address],
    });
    console.log("Balance: ", balance);
    return balance as `0x${string}`;
  };

  const handleReadBalance = async () => {
    const balance = await readBalanceHandle();
    const decrptedBalance = await decryptValue({
      walletClient: walletClient!,
      handle: balance!,
    });
    console.log("Decrypted balance: ", decrptedBalance);

    const formattedBalance = formatEther(decrptedBalance);

    console.log("Decrypted balance: ", formattedBalance);

    setBalance(formattedBalance);
  };

  return (
    <div className="mt-8 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium">Balance:</span>
          <span className="ml-2 font-mono">{balance || "0"} cUSDC</span>
        </div>
        <button
          onClick={handleReadBalance}
          className="bg-gray-600 text-white py-2 px-4 rounded-full hover:bg-gray-700 transition-colors"
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default Balance;
