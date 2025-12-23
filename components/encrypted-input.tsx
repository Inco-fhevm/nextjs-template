import { useEffect, useState } from "react";
import { encryptValue, getFee } from "@/utils/inco";
import Mint from "./mint";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { CERC_CONTRACT_ADDRESS } from "@/utils/constants";

const EncryptedInput = () => {
  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState<string>("");
  const { address } = useAccount();
  const [fee, setFee] = useState<string>("0");
  
  useEffect(() => {
    const fetchFee = async () => {
      const fee = await getFee();
      setFee(formatEther(fee).toString());
    };
    fetchFee();
  }, []);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    console.log("Value: ", e.target.value);
    const encryptedVal = await encryptValue({
      value: parseEther(e.target.value),
      address: address as `0x${string}`,
      contractAddress: CERC_CONTRACT_ADDRESS,
    });
    setEncryptedValue(encryptedVal);
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">Encrypted Input</h2>
      <input
        type="text"
        className="w-full p-2 border border-gray-300 rounded-md"
        onChange={handleChange}
        value={value}
      />

      {encryptedValue && (
        <p>
          Encrypted Value:{" "}
          <span className="text-blue-500 truncate max-w-xs text-ellipsis">
            {encryptedValue}
          </span>
        </p>
      )}

      {encryptedValue && (
        <div>
          <Mint encryptedValue={encryptedValue as `0x${string}`} />
          <p>for minting you will need {fee} ETH on base Sepolia</p>
        </div>
      )}
    </div>
  );
};

export default EncryptedInput;
