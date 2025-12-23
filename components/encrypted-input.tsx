import { useEffect, useState } from "react";
import { encryptValue, getFee } from "@/utils/inco";
import Mint from "./mint";
import { formatEther, parseEther } from "viem";
import { useAccount } from "wagmi";
import { CERC_CONTRACT_ADDRESS } from "@/utils/constants";

const EncryptedInput = () => {
  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState<string>("");
  const [showFullEncrypted, setShowFullEncrypted] = useState(false);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const { address } = useAccount();
  const [fee, setFee] = useState<string>("0");

  useEffect(() => {
    const fetchFee = async () => {
      const fee = await getFee();
      setFee(formatEther(fee).toString());
    };
    fetchFee();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setTxHash(null); // Clear previous transaction hash when starting new input
    setEncryptedValue(""); // Clear encrypted value when input changes
  };

  const handleEncrypt = async () => {
    if (!value || !address) return;

    setIsEncrypting(true);
    try {
      const encryptedVal = await encryptValue({
        value: parseEther(value),
        address: address as `0x${string}`,
        contractAddress: CERC_CONTRACT_ADDRESS,
      });
      setEncryptedValue(encryptedVal);
    } catch (error) {
      console.error("Encryption failed:", error);
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleMintSuccess = (hash: `0x${string}`) => {
    setTxHash(hash);
    setValue("");
    setEncryptedValue("");
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(encryptedValue);
      // Could add a toast notification here
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const truncateHash = (hash: string) => {
    if (hash.length <= 20) return hash;
    return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
  };

  const getExplorerUrl = (hash: string) => {
    return `https://sepolia.basescan.org/tx/${hash}`;
  };

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Amount to Mint</label>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Enter amount..."
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={handleChange}
            value={value}
          />
          <button
            onClick={handleEncrypt}
            disabled={isEncrypting || !value}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isEncrypting ? "Encrypting..." : "Encrypt"}
          </button>
        </div>
      </div>

      {encryptedValue && (
        <div>
          <label className="block text-sm font-medium mb-2">
            Encrypted Value
          </label>
          <div className="bg-gray-100 p-3 rounded-full border flex items-center justify-between">
            <div className="flex-1 truncate pr-2">
              {showFullEncrypted
                ? encryptedValue
                : truncateHash(encryptedValue)}
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowFullEncrypted(!showFullEncrypted)}
                className="text-blue-600 hover:text-blue-800 text-xs underline"
              >
                {showFullEncrypted ? "Truncate" : "Show Full"}
              </button>
              <button
                onClick={copyToClipboard}
                className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
        </div>
      )}

      {encryptedValue && (
        <div className="space-y-2">
          <Mint
            encryptedValue={encryptedValue as `0x${string}`}
            onMintSuccess={handleMintSuccess}
          />
          <p className="text-sm text-gray-600">
            Fee: {fee} ETH on Base Sepolia
          </p>
        </div>
      )}

      {txHash && (
        <div className="space-y-2">
          <div className="bg-green-50 border border-green-200 rounded-xl p-3">
            <p className="text-sm font-medium text-green-800 mb-1">
              ✅ Minting Successful!
            </p>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-green-700 font-mono">
                {truncateHash(txHash)}
              </span>
              <a
                href={getExplorerUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-green-600 text-white px-3 py-1 rounded-full text-xs hover:bg-green-700 transition-colors"
              >
                View on Explorer
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptedInput;
