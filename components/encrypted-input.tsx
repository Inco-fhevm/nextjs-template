"use client";

import { useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import {
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Buffer } from "buffer";
import {
  INCO_BASE_PROGRAM_ID,
  PROGRAM_ID,
  MINT_DISCRIMINATOR,
} from "@/utils/constants";

const findTokenStatePDA = () =>
  PublicKey.findProgramAddressSync([Buffer.from("token_state")], PROGRAM_ID)[0];

const findBalancePDA = (owner: PublicKey) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("balance"), owner.toBuffer()],
    PROGRAM_ID
  )[0];

const EncryptedInput = () => {
  const { publicKey, signTransaction, connected } = useWallet();
  const { connection } = useConnection();
  const [value, setValue] = useState("");
  const [encryptedValue, setEncryptedValue] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isEncrypting, setIsEncrypting] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEncrypt = async () => {
    if (!value) return;
    setIsEncrypting(true);
    setError(null);
    try {
      setEncryptedValue(await encryptValue(BigInt(value)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Encryption failed");
    } finally {
      setIsEncrypting(false);
    }
  };

  const handleMint = async () => {
    if (!connected || !publicKey || !signTransaction || !encryptedValue) {
      return setError("Wallet not connected or no encrypted value");
    }

    setIsMinting(true);
    setError(null);

    try {
      const ciphertext = Buffer.from(encryptedValue.replace("0x", ""), "hex");

      const mintData = Buffer.concat([
        Buffer.from(MINT_DISCRIMINATOR),
        Buffer.from(new Uint32Array([ciphertext.length]).buffer),
        ciphertext,
        Buffer.from([1]), // inputType
      ]);

      const tx = new Transaction().add(
        new TransactionInstruction({
          keys: [
            { pubkey: findTokenStatePDA(), isSigner: false, isWritable: true },
            {
              pubkey: findBalancePDA(publicKey),
              isSigner: false,
              isWritable: true,
            },
            { pubkey: publicKey, isSigner: true, isWritable: true },
            { pubkey: publicKey, isSigner: false, isWritable: false },
            {
              pubkey: SystemProgram.programId,
              isSigner: false,
              isWritable: false,
            },
            {
              pubkey: INCO_BASE_PROGRAM_ID,
              isSigner: false,
              isWritable: false,
            },
          ],
          programId: PROGRAM_ID,
          data: mintData,
        })
      );

      const { blockhash } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = publicKey;

      const signed = await signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });
      await connection.confirmTransaction(sig, "confirmed");

      setTxHash(sig);
      setValue("");
      setEncryptedValue("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mint");
    } finally {
      setIsMinting(false);
    }
  };

  const truncate = (s: string) =>
    s.length <= 20 ? s : `${s.slice(0, 10)}...${s.slice(-8)}`;

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Amount to Mint</label>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Enter amount..."
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              setValue(e.target.value);
              setTxHash(null);
              setEncryptedValue("");
              setError(null);
            }}
            value={value}
          />
          <button
            onClick={handleEncrypt}
            disabled={isEncrypting || !value || !connected}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isEncrypting ? "Encrypting..." : "Encrypt"}
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {encryptedValue && (
        <>
          <div>
            <label className="block text-sm font-medium mb-2">
              Encrypted Value
            </label>
            <div className="bg-gray-100 p-3 rounded-full border flex items-center justify-between">
              <span className="text-sm font-mono truncate flex-1">
                {truncate(encryptedValue)}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(encryptedValue)}
                className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700 transition-colors"
              >
                Copy
              </button>
            </div>
          </div>
          <button
            onClick={handleMint}
            disabled={isMinting}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
          >
            {isMinting ? "Minting..." : "Mint cUSDC"}
          </button>
        </>
      )}

      {txHash && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3">
          <p className="text-sm font-medium text-green-800 mb-1">
            ✅ Minting Successful!
          </p>
          <div className="flex items-center space-x-2">
            <span className="text-xs text-green-700 font-mono">
              {truncate(txHash)}
            </span>
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-green-600 text-white px-3 py-1 rounded-full text-xs hover:bg-green-700 transition-colors"
            >
              View on Explorer
            </a>
          </div>
        </div>
      )}
    </div>
  );
};

export default EncryptedInput;
