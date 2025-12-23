import { CERC_ABI, CERC_CONTRACT_ADDRESS } from "@/utils/constants";
import { getFee } from "@/utils/inco";
import React from "react";
import { useWriteContract } from "wagmi";

const Mint = ({ encryptedValue }: { encryptedValue: `0x${string}` }) => {
  const { writeContractAsync } = useWriteContract();
  const handleMint = async () => {
    const fee = await getFee();
    console.log("Fee: ", fee);
    const minted = await writeContractAsync({
      address: CERC_CONTRACT_ADDRESS,
      abi: CERC_ABI,
      functionName: "encryptedMint",
      args: [encryptedValue],
      value: fee,
    });
  };
  return (
    <button onClick={handleMint} disabled={!encryptedValue}>
      Mint
    </button>
  );
};

export default Mint;
