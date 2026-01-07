const Mint = ({
  encryptedValue,
  onMintSuccess,
}: {
  encryptedValue: `0x${string}`;
  onMintSuccess?: (txHash: `0x${string}`) => void;
}) => {
  const handleMint = async () => {
    // Empty function - logic removed
    // Pass fake transaction hash to parent for display
    onMintSuccess?.("0x1234567890abcdef" as `0x${string}`);
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
