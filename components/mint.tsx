import { CERC_ABI, CERC_CONTRACT_ADDRESS } from "@/utils/constants";
import { getFee, publicClient } from "@/utils/inco";
import { useWriteContract } from "wagmi";

const Mint = ({
  encryptedValue,
  onMintSuccess,
}: {
  encryptedValue: `0x${string}`;
  onMintSuccess?: (txHash: `0x${string}`) => void;
}) => {
  const { writeContractAsync } = useWriteContract();
  const handleMint = async () => {
    const fee = await getFee();
    console.log("Fee: ", fee);
    const hash = await writeContractAsync({
      address: CERC_CONTRACT_ADDRESS,
      abi: CERC_ABI,
      functionName: "encryptedMint",
      args: [encryptedValue],
      value: fee,
    });

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: hash,
    });

    if (receipt.status !== "success") {
      throw new Error("Transaction failed");
    }

    console.log("Receipt: ", receipt);
    // Pass transaction hash to parent for display
    onMintSuccess?.(hash);
  };
  return (
    <button
      onClick={handleMint}
      disabled={!encryptedValue}
      className="w-full bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
    >
      Mint cUSDC
    </button>
  );
};

export default Mint;
