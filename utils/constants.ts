export const CERC_CONTRACT_ADDRESS =
  "0x7bad07b6b6064dfb033207794625ffa4322cb392";

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
