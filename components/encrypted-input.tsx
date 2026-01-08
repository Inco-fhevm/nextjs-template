"use client";

import { useState, useEffect, useRef } from "react";
import {
  useWallet,
  useConnection,
  useAnchorWallet,
} from "@solana/wallet-adapter-react";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { Keypair, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { fetchUserMint, fetchUserTokenAccount } from "@/utils/constants";
import { getProgram } from "@/utils/program";

const EncryptedInput = () => {
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
    if (!key) {
      setMint(null);
      setAccount(null);
      return;
    }

    (async () => {
      const m = await fetchUserMint(connection, publicKey!);
      if (m) {
        setMint(m.pubkey.toBase58());
        const a = await fetchUserTokenAccount(connection, publicKey!, m.pubkey);
        setAccount(a?.pubkey.toBase58() ?? null);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const handleEncrypt = async () => {
    if (!value) return;
    setLoading(true);
    try {
      setEncrypted(await encryptValue(BigInt(value)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encryption failed");
    }
    setLoading(false);
  };

  const handleMint = async () => {
    if (!publicKey || !wallet || !encrypted) return setError("Missing data");
    setLoading(true);
    setError(null);

    try {
      const program = getProgram(connection, wallet);
      const ciphertext = Buffer.from(encrypted.replace("0x", ""), "hex");
      const signers: Keypair[] = [];
      const tx = new Transaction();
      let m = mint,
        a = account;

      if (!m) {
        const kp = Keypair.generate();
        tx.add(
          await program.methods
            .initializeMint(9, publicKey, publicKey)
            .accounts({ mint: kp.publicKey, payer: publicKey })
            .instruction()
        );
        signers.push(kp);
        m = kp.publicKey.toBase58();
      }

      if (!a) {
        const kp = Keypair.generate();
        tx.add(
          await program.methods
            .initializeAccount()
            .accounts({
              account: kp.publicKey,
              mint: m,
              owner: publicKey,
              payer: publicKey,
            })
            .instruction()
        );
        signers.push(kp);
        a = kp.publicKey.toBase58();
      }

      tx.add(
        await program.methods
          .mintTo(ciphertext, 0)
          .accounts({ mint: m, account: a, mintAuthority: publicKey })
          .instruction()
      );

      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      tx.feePayer = publicKey;
      if (signers.length) tx.partialSign(...signers);

      const sig = await sendTransaction(tx, connection);
      await connection.confirmTransaction(sig, "confirmed");

      setMint(m);
      setAccount(a);
      setTxHash(sig);
      setValue("");
      setEncrypted("");
      window.dispatchEvent(new CustomEvent("token-minted"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
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
            className="flex-1 p-3 border border-gray-300 rounded-full bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            onChange={(e) => {
              setValue(e.target.value);
              setTxHash(null);
              setEncrypted("");
              setError(null);
            }}
            value={value}
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
};

export default EncryptedInput;
