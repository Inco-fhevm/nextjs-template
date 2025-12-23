import { AttestedComputeSupportedOps, Lightning } from "@inco/js/lite";
import { handleTypes } from "@inco/js";
import type { WalletClient, Transport, Account, Chain } from "viem";
import { bytesToHex, createPublicClient, http, pad, toHex } from "viem";
import { baseSepolia } from "viem/chains";

export type IncoWalletClient = WalletClient<Transport, Chain, Account>;

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});

export async function getConfig() {
  const chainId = publicClient.chain.id;
  return Lightning.latest("devnet", chainId); // TODO: Change to testnet when testnet is available
}

export async function encryptValue({
  value,
  address,
  contractAddress,
}: {
  value: bigint;
  address: `0x${string}`;
  contractAddress: `0x${string}`;
}): Promise<`0x${string}`> {
  const inco = await getConfig();

  const encryptedData = await inco.encrypt(value, {
    accountAddress: address,
    dappAddress: contractAddress,
    handleType: handleTypes.euint256,
  });

  console.log("Encrypted data: ", encryptedData);

  return encryptedData as `0x${string}`;
}

export async function decryptValue({
  walletClient,
  handle,
}: {
  walletClient: IncoWalletClient;
  handle: string;
}): Promise<bigint> {
  const inco = await getConfig();

  const attestedDecrypt = await inco.attestedDecrypt(walletClient, [
    handle as `0x${string}`,
  ]);

  return attestedDecrypt[0].plaintext.value as bigint;
}

export const attestedCompute = async ({
  walletClient,
  lhsHandle,
  op,
  rhsPlaintext,
}: {
  walletClient: IncoWalletClient;
  lhsHandle: `0x${string}`;
  op: (typeof AttestedComputeSupportedOps)[keyof typeof AttestedComputeSupportedOps];
  rhsPlaintext: bigint | boolean;
}) => {
  const incoConfig = await getConfig();

  const result = await incoConfig.attestedCompute(
    walletClient,
    lhsHandle as `0x${string}`,
    op,
    rhsPlaintext
  );

  // Convert Uint8Array signatures to hex strings
  const signatures = result.covalidatorSignatures.map((sig: Uint8Array) =>
    bytesToHex(sig)
  );

  // Encode the plaintext value as bytes32
  // For boolean: true = 1, false = 0, padded to 32 bytes
  const encodedValue = pad(toHex(result.plaintext.value ? 1 : 0), { size: 32 });

  // Return in format expected by contract:
  // - plaintext: the actual decrypted value
  // - attestation: { handle, value } for the DecryptionAttestation struct
  // - signature array for verification
  return {
    plaintext: result.plaintext.value,
    attestation: {
      handle: result.handle,
      value: encodedValue,
    },
    signature: signatures,
  };
};

/**
 * Get the fee required for Inco operations
 */
export async function getFee(): Promise<bigint> {
  const inco = await getConfig();

  // Read the fee from the Lightning contract
  const fee = await publicClient.readContract({
    address: inco.executorAddress,
    abi: [
      {
        type: "function",
        inputs: [],
        name: "getFee",
        outputs: [{ name: "", internalType: "uint256", type: "uint256" }],
        stateMutability: "pure",
      },
    ],
    functionName: "getFee",
  });

  console.log("Fee: ", fee);
  return fee;
}
