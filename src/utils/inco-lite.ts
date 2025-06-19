import {
    getAddress,
    WalletClient,
    Account,
    Transport,
    Chain,
  } from "viem";
  import { Lightning } from "@inco/js/lite";
  
  export const getConfig = () => {
    return Lightning.latest("demonet", 84532);
  };
  
  export const encryptValue = async ({
    value,
    address,
    contractAddress,
  }: {
    value: bigint;
    address: `0x${string}`;
    contractAddress: `0x${string}`;
  }) => {
    const valueBigInt = BigInt(value);
  
    const checksummedAddress = getAddress(contractAddress);
  
    const incoConfig = getConfig();
  
    const encryptedData = await incoConfig.encrypt(valueBigInt, {
      accountAddress: address,
      dappAddress: checksummedAddress,
    });
  
    return encryptedData;
  };
  
  export const reEncryptValue = async ({
    walletClient,
    handle,
  }: {
    walletClient: WalletClient;
    handle: string;
    isformat?: boolean;
  }) => {
    if (!walletClient || !handle) {
      throw new Error("Missing required parameters for creating reencryptor");
    }
  
    try {
      const incoConfig = getConfig();
      const reencryptor = await incoConfig.getReencryptor(
        walletClient as WalletClient<Transport, Chain, Account>
      );
      const backoffConfig = {
        maxRetries: 100,
        baseDelayInMs: 1000,
        backoffFactor: 1.5,
      };
  
      const decryptedResult = await reencryptor(
        { handle: handle as `0x${string}` },
        backoffConfig
      );
  
      if (!decryptedResult) {
        throw new Error("Failed to decrypt");
      }
  
      return decryptedResult.value;
    } catch (error: unknown) {
      console.error("Reencryption error:", error);
      if (error instanceof Error) {
        throw new Error(`Failed to reencrypt: ${error.message}`);
      }
      throw new Error("Failed to reencrypt: Unknown error");
    }
  };