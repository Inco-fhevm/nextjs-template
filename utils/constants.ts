export const CERC_CONTRACT_ADDRESS =
  "0xe1e87e9989d6c27c89c26b0eb4d4c1298d28ed14";

export const CERC_ABI = [
  {
    inputs: [
      {
        internalType: "bytes",
        name: "encryptedAmount",
        type: "bytes",
      },
    ],
    name: "encryptedMint",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
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
] as const;
