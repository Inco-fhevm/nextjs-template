import React, { useState } from "react";

const Balance = () => {
  const [balance, setBalance] = useState<string | undefined>(undefined);

  const handleReadBalance = async () => {
    // Empty function - logic removed
    setBalance("0");
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
