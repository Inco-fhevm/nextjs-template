"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useEffect, useRef } from "react";
import {
  useWallet,
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { hexToBuffer } from "@inco/solana-sdk/utils";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import {
  fetchUserMint,
  fetchUserTokenAccount,
  getAllowancePda,
  extractHandle,
  getProgram,
} from "@/utils/constants";

export default function EncryptedInput() {
  const { publicKey, connected, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const lastWallet = useRef<string | null>(null);

  const [mint, setMint] = useState<string | null>(null);
  const [account, setAccount] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [encrypted, setEncrypted] = useState("");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const key = publicKey?.toBase58() ?? null;
    if (key === lastWallet.current) return;
    lastWallet.current = key;
    setMint(null);
    setAccount(null);
    if (!key) return;

    (async () => {
      const m = await fetchUserMint(connection, publicKey!);
      if (m) {
        setMint(m.pubkey.toBase58());
        const a = await fetchUserTokenAccount(connection, publicKey!, m.pubkey);
        setAccount(a?.pubkey.toBase58() ?? null);
      }
    })();
  }, [publicKey, connection]);

  const handleEncrypt = async () => {
    if (!value) return;
    setLoading(true);
    try {
      setEncrypted(
        await encryptValue(BigInt(Math.floor(parseFloat(value) * 1e6)))
      );
    } catch (e: any) {
      setError(e.message || "Encryption failed");
    }
    setLoading(false);
  };

  const handleMint = async () => {
    if (!publicKey || !wallet || !encrypted) return setError("Missing data");
    setLoading(true);
    setError(null);

    try {
      const program = getProgram(connection, wallet);
      const ciphertext = hexToBuffer(encrypted);
      let m = mint,
        a = account;

      if (!m || !a) {
        const signers: Keypair[] = [];
        const tx = new Transaction();

        if (!m) {
          const kp = Keypair.generate();
          m = kp.publicKey.toBase58();
          signers.push(kp);
          tx.add(
            await program.methods
              .initializeMint(6, publicKey, publicKey)
              .accounts({
                mint: kp.publicKey,
                payer: publicKey,
                systemProgram: SystemProgram.programId,
              } as any)
              .instruction()
          );
        }

        if (!a) {
          const kp = Keypair.generate();
          a = kp.publicKey.toBase58();
          signers.push(kp);
          tx.add(
            await program.methods
              .initializeAccount()
              .accounts({
                account: kp.publicKey,
                mint: m,
                owner: publicKey,
                payer: publicKey,
                systemProgram: SystemProgram.programId,
              } as any)
              .instruction()
          );
        }

        tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        tx.feePayer = publicKey;
        tx.partialSign(...signers);
        await connection.confirmTransaction(
          await sendTransaction(tx, connection),
          "confirmed"
        );
        setMint(m);
        setAccount(a);
        await new Promise((r) => setTimeout(r, 1000));
      }

      const mintPk = new PublicKey(m),
        accPk = new PublicKey(a);
      const accs = {
        mint: mintPk,
        account: accPk,
        mintAuthority: publicKey,
        systemProgram: SystemProgram.programId,
      };

      const simTx = await program.methods
        .mintTo(ciphertext, 0)
        .accounts(accs as any)
        .transaction();
      simTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      simTx.feePayer = publicKey;

      const sim = await connection.simulateTransaction(simTx, undefined, [
        accPk,
      ]);
      if (sim.value.err)
        throw new Error(`Simulation failed: ${JSON.stringify(sim.value.err)}`);

      const data = sim.value.accounts?.[0]?.data;
      if (!data) throw new Error("No simulation data");
      const handle = extractHandle(Buffer.from(data[0], "base64"));
      if (!handle) throw new Error("No handle");

      const [allowancePda] = getAllowancePda(handle, publicKey);
      const sig = await program.methods
        .mintTo(ciphertext, 0)
        .accounts(accs as any)
        .remainingAccounts([
          { pubkey: allowancePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: false, isWritable: false },
        ])
        .rpc();

      setTxHash(sig);
      setValue("");
      setEncrypted("");
      window.dispatchEvent(new CustomEvent("token-minted"));
    } catch (e: any) {
      console.error(e);
      setError(e.message || "Failed");
    }
    setLoading(false);
  };

  const truncate = (s: string) =>
    s.length <= 16 ? s : `${s.slice(0, 6)}...${s.slice(-4)}`;

  return (
    <div className="mt-8 space-y-4">
      <div>
        <label className="block text-sm font-medium mb-2">Amount to Mint</label>
        <div className="flex space-x-2">
          <input
            type="number"
            placeholder="Enter amount..."
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setTxHash(null);
              setEncrypted("");
              setError(null);
            }}
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleEncrypt}
            disabled={loading || !value || !connected}
            className="px-6 py-3 bg-blue-600 text-white rounded-full hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {loading ? "..." : "Encrypt"}
          </button>
        </div>
      </div>

      {encrypted && (
        <>
          <div className="bg-gray-100 p-3 rounded-full border flex items-center justify-between">
            <span className="text-sm font-mono truncate flex-1">
              {truncate(encrypted)}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(encrypted)}
              className="ml-2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs hover:bg-blue-700"
            >
              Copy
            </button>
          </div>
          <button
            onClick={handleMint}
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-full hover:bg-blue-700 disabled:bg-gray-300"
          >
            {loading ? "Processing..." : "Mint Tokens"}
          </button>
        </>
      )}

      {error && (
        <p className="text-sm text-red-500 bg-red-50 p-3 rounded-xl">{error}</p>
      )}
      {txHash && (
        <div className="bg-green-50 p-3 rounded-xl">
          <p className="text-sm text-green-800">
            ✅ Success!{" "}
            <a
              href={`https://explorer.solana.com/tx/${txHash}?cluster=devnet`}
              target="_blank"
              className="underline"
            >
              View tx
            </a>
          </p>
        </div>
      )}
    </div>
  );
}
