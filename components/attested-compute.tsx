"use client";

import { CERC_ABI, CERC_CONTRACT_ADDRESS } from "@/utils/constants";
import { attestedCompute } from "@/utils/inco";
import { AttestedComputeSupportedOps } from "@inco/lightning-js/lite";
import { useState } from "react";
import { parseEther } from "viem";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";

type OpKey = keyof typeof AttestedComputeSupportedOps;

// Human-readable symbols for each supported comparison op.
const OP_LABELS: Record<OpKey, string> = {
  Ge: "≥",
  Gt: ">",
  Le: "≤",
  Lt: "<",
  Eq: "=",
  Ne: "≠",
};

const AttestedComputeCard = () => {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { address } = useAccount();

  const [op, setOp] = useState<OpKey>("Ge");
  const [threshold, setThreshold] = useState("");
  const [result, setResult] = useState<boolean | null>(null);
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAttestedCompute = async () => {
    if (!address || !publicClient || !walletClient || !threshold) return;

    setIsComputing(true);
    setError(null);
    setResult(null);

    try {
      // The balance handle is already decryptable by the connected wallet
      // (the contract grants `e.allow(balance, msg.sender)`), so the covalidator
      // can attest a comparison against it without revealing the balance.
      const balanceHandle = (await publicClient.readContract({
        address: CERC_CONTRACT_ADDRESS,
        abi: CERC_ABI,
        functionName: "balanceOf",
        args: [address],
      })) as `0x${string}`;

      const { plaintext } = await attestedCompute({
        walletClient,
        lhsHandle: balanceHandle,
        op: AttestedComputeSupportedOps[op],
        rhsPlaintext: parseEther(threshold),
      });

      setResult(Boolean(plaintext));
    } catch (err) {
      console.error("Attested compute failed:", err);
      setError(err instanceof Error ? err.message : "Attested compute failed");
    } finally {
      setIsComputing(false);
    }
  };

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">
          Attested Compute — prove a fact about your balance privately
        </label>
        <div className="flex space-x-2">
          <select
            value={op}
            onChange={(e) => {
              setOp(e.target.value as OpKey);
              setResult(null);
            }}
            className="p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {(Object.keys(OP_LABELS) as OpKey[]).map((key) => (
              <option key={key} value={key}>
                {OP_LABELS[key]}
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="Threshold (cUSD)..."
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={threshold}
            onChange={(e) => {
              setThreshold(e.target.value);
              setResult(null);
            }}
          />
          <button
            onClick={handleAttestedCompute}
            disabled={isComputing || !threshold || !address}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
          >
            {isComputing ? "Computing..." : "Attested Compute"}
          </button>
        </div>
      </div>

      {result !== null && (
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
          <p className="text-sm">
            <span className="font-medium">balance {OP_LABELS[op]} {threshold} cUSD</span>{" "}
            ⇒{" "}
            <span
              className={`font-mono font-semibold ${
                result ? "text-green-600" : "text-red-600"
              }`}
            >
              {String(result)}
            </span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Covalidator-signed off-chain — submittable on-chain for verification.
          </p>
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-700 break-words">{error}</p>
        </div>
      )}
    </div>
  );
};

export default AttestedComputeCard;
