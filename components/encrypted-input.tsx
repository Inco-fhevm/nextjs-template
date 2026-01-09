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
  TransactionInstruction,
} from "@solana/web3.js";
import {
  fetchUserMint,
  fetchUserTokenAccount,
  getAllowancePda,
  extractHandle,
  INCO_LIGHTNING_PROGRAM_ID,
} from "@/utils/constants";
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

    // Clear state immediately on wallet change
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicKey]);

  const handleEncrypt = async () => {
    if (!value) return;
    setLoading(true);
    try {
      const amount = BigInt(Math.floor(parseFloat(value) * 1e6));
      setEncrypted(await encryptValue(amount));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Encryption failed");
    }
    setLoading(false);
  };

  const handleMint = async () => {
    if (!publicKey || !wallet || !encrypted) {
      return setError("Missing data");
    }
    setLoading(true);
    setError(null);

    try {
      const program = getProgram(connection, wallet);
      const ciphertext = hexToBuffer(encrypted);
      const inputType = 0;

      let m = mint,
        a = account;

      // Step 1: Create accounts if needed (separate tx for new users)
      if (!m || !a) {
        const initSigners: Keypair[] = [];
        const initInstructions: TransactionInstruction[] = [];

        let mintKp: Keypair | null = null;
        let accountKp: Keypair | null = null;

        if (!m) {
          mintKp = Keypair.generate();
          m = mintKp.publicKey.toBase58();
          initSigners.push(mintKp);
          initInstructions.push(
            await program.methods
              .initializeMint(6, publicKey, publicKey)
              .accounts({
                mint: mintKp.publicKey,
                payer: publicKey,
                systemProgram: SystemProgram.programId,
                incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
              } as any)
              .instruction()
          );
        }

        if (!a) {
          accountKp = Keypair.generate();
          a = accountKp.publicKey.toBase58();
          initSigners.push(accountKp);
          initInstructions.push(
            await program.methods
              .initializeAccount()
              .accounts({
                account: accountKp.publicKey,
                mint: m,
                owner: publicKey,
                payer: publicKey,
                systemProgram: SystemProgram.programId,
                incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
              } as any)
              .instruction()
          );
        }

        // Send init transaction
        const initTx = new Transaction();
        initTx.recentBlockhash = (
          await connection.getLatestBlockhash()
        ).blockhash;
        initTx.feePayer = publicKey;
        initInstructions.forEach((ix) => initTx.add(ix));
        initTx.partialSign(...initSigners);

        const initSig = await sendTransaction(initTx, connection);
        await connection.confirmTransaction(initSig, "confirmed");

        setMint(m);
        setAccount(a);

        // Wait for state to propagate
        await new Promise((r) => setTimeout(r, 1000));
      }

      const mintPubkey = new PublicKey(m);
      const accountPubkey = new PublicKey(a);

      // Step 2: Simulate mintTo to get handle
      const simTx = await program.methods
        .mintTo(ciphertext, inputType)
        .accounts({
          mint: mintPubkey,
          account: accountPubkey,
          mintAuthority: publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .transaction();

      simTx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      simTx.feePayer = publicKey;

      const simulation = await connection.simulateTransaction(
        simTx,
        undefined,
        [accountPubkey]
      );

      if (simulation.value.err) {
        throw new Error(
          `Simulation failed: ${JSON.stringify(simulation.value.err)}`
        );
      }

      // Extract handle
      let newHandle: bigint | null = null;
      if (simulation.value.accounts?.[0]?.data) {
        const data = Buffer.from(
          simulation.value.accounts[0].data[0],
          "base64"
        );
        newHandle = extractHandle(data);
      }

      if (!newHandle) throw new Error("Could not get handle from simulation");

      // Step 3: Execute mintTo with allowance PDA
      const [allowancePda] = getAllowancePda(newHandle, publicKey);

      const sig = await program.methods
        .mintTo(ciphertext, inputType)
        .accounts({
          mint: mintPubkey,
          account: accountPubkey,
          mintAuthority: publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: allowancePda, isSigner: false, isWritable: true },
          { pubkey: publicKey, isSigner: false, isWritable: false },
        ])
        .rpc();

      setTxHash(sig);
      setValue("");
      setEncrypted("");
      window.dispatchEvent(new CustomEvent("token-minted"));
    } catch (e) {
      console.error(e);
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
