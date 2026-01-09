import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import type { IncoToken } from "../target/types/inco_token.js";
import { PublicKey, Keypair, SystemProgram, Connection } from "@solana/web3.js";
import { expect } from "chai";
import nacl from "tweetnacl";
import { encryptValue } from "@inco/solana-sdk/encryption";
import { decrypt } from "@inco/solana-sdk/attested-decrypt";
import { hexToBuffer } from "@inco/solana-sdk/utils";

const INCO_LIGHTNING_PROGRAM_ID = new PublicKey("5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj");

function extractHandleFromAnchor(anchorHandle: any): bigint {
  if (anchorHandle && anchorHandle._bn) {
    return BigInt(anchorHandle._bn.toString(10));
  }
  if (typeof anchorHandle === 'object' && anchorHandle["0"]) {
    const nested = anchorHandle["0"];
    if (nested && nested._bn) return BigInt(nested._bn.toString(10));
    if (nested && nested.toString && nested.constructor?.name === 'BN') {
      return BigInt(nested.toString(10));
    }
  }
  if (anchorHandle instanceof Uint8Array || Array.isArray(anchorHandle)) {
    const buffer = Buffer.from(anchorHandle);
    let result = BigInt(0);
    for (let i = buffer.length - 1; i >= 0; i--) {
      result = result * BigInt(256) + BigInt(buffer[i]);
    }
    return result;
  }
  if (typeof anchorHandle === 'number' || typeof anchorHandle === 'bigint') {
    return BigInt(anchorHandle);
  }
  return BigInt(0);
}

function getAllowancePda(handle: bigint, allowedAddress: PublicKey): [PublicKey, number] {
  const handleBuffer = Buffer.alloc(16);
  let h = handle;
  for (let i = 0; i < 16; i++) {
    handleBuffer[i] = Number(h & BigInt(0xff));
    h = h >> BigInt(8);
  }
  return PublicKey.findProgramAddressSync(
    [handleBuffer, allowedAddress.toBuffer()],
    INCO_LIGHTNING_PROGRAM_ID
  );
}

function formatBalance(plaintext: string): string {
  return (Number(plaintext) / 1e9).toFixed(9);
}

describe("inco-token", () => {
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");
  const provider = new anchor.AnchorProvider(connection, anchor.AnchorProvider.env().wallet, {
    commitment: "confirmed",
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  const program = anchor.workspace.IncoToken as Program<IncoToken>;
  const inputType = 0;

  let mintKeypair: Keypair;
  let walletKeypair: Keypair;
  let ownerAccountKp: Keypair;
  let recipientAccountKp: Keypair;
  let delegateAccountKp: Keypair;

  before(async () => {
    walletKeypair = (provider.wallet as any).payer as Keypair;
    mintKeypair = Keypair.generate();
    ownerAccountKp = Keypair.generate();
    recipientAccountKp = Keypair.generate();
    delegateAccountKp = Keypair.generate();
  });

  async function decryptHandle(handle: string): Promise<{ success: boolean; plaintext?: string; error?: string }> {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const result = await decrypt([handle], {
        address: walletKeypair.publicKey,
        signMessage: async (message: Uint8Array) => nacl.sign.detached(message, walletKeypair.secretKey),
      });
      return { success: true, plaintext: result.plaintexts[0] };
    } catch (error: any) {
      const msg = error.message || error.toString();
      if (msg.toLowerCase().includes("not allowed")) return { success: false, error: "not_allowed" };
      if (msg.toLowerCase().includes("ciphertext")) return { success: false, error: "ciphertext_not_found" };
      return { success: false, error: msg };
    }
  }

  async function simulateAndGetHandle(tx: anchor.web3.Transaction, accountPubkey: PublicKey): Promise<bigint | null> {
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = walletKeypair.publicKey;
      tx.sign(walletKeypair);

      const simulation = await connection.simulateTransaction(tx, undefined, [accountPubkey]);
      if (simulation.value.err) return null;

      if (simulation.value.accounts?.[0]?.data) {
        const data = Buffer.from(simulation.value.accounts[0].data[0], "base64");
        const amountBytes = data.slice(72, 88);
        let handle = BigInt(0);
        for (let i = 15; i >= 0; i--) {
          handle = handle * BigInt(256) + BigInt(amountBytes[i]);
        }
        return handle;
      }
      return null;
    } catch {
      return null;
    }
  }

  async function simulateTransferAndGetHandles(
    tx: anchor.web3.Transaction,
    sourcePubkey: PublicKey,
    destPubkey: PublicKey
  ): Promise<{ sourceHandle: bigint | null; destHandle: bigint | null }> {
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      tx.recentBlockhash = blockhash;
      tx.feePayer = walletKeypair.publicKey;
      tx.sign(walletKeypair);

      const simulation = await connection.simulateTransaction(tx, undefined, [sourcePubkey, destPubkey]);
      if (simulation.value.err) return { sourceHandle: null, destHandle: null };

      const extractHandle = (accountData: any): bigint | null => {
        if (!accountData?.data) return null;
        const data = Buffer.from(accountData.data[0], "base64");
        const amountBytes = data.slice(72, 88);
        let handle = BigInt(0);
        for (let i = 15; i >= 0; i--) {
          handle = handle * BigInt(256) + BigInt(amountBytes[i]);
        }
        return handle;
      };

      return {
        sourceHandle: extractHandle(simulation.value.accounts?.[0]),
        destHandle: extractHandle(simulation.value.accounts?.[1]),
      };
    } catch {
      return { sourceHandle: null, destHandle: null };
    }
  }

  describe("Initialize", () => {
    it("Should initialize mint", async () => {
      const tx = await program.methods
        .initializeMint(9, walletKeypair.publicKey, walletKeypair.publicKey)
        .accounts({
          mint: mintKeypair.publicKey,
          payer: walletKeypair.publicKey,
          systemProgram: SystemProgram.programId,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .signers([mintKeypair])
        .rpc();

      console.log("Initialize mint:", tx);
      const mintAccount = await program.account.incoMint.fetch(mintKeypair.publicKey);
      expect(mintAccount.isInitialized).to.be.true;
      expect(mintAccount.decimals).to.equal(9);
    });

    it("Should initialize token accounts", async () => {
      const accounts = [
        { kp: ownerAccountKp, name: "owner" },
        { kp: recipientAccountKp, name: "recipient" },
        { kp: delegateAccountKp, name: "delegate" },
      ];

      for (const { kp, name } of accounts) {
        const tx = await program.methods
          .initializeAccount()
          .accounts({
            account: kp.publicKey,
            mint: mintKeypair.publicKey,
            owner: walletKeypair.publicKey,
            payer: walletKeypair.publicKey,
            systemProgram: SystemProgram.programId,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          } as any)
          .signers([kp])
          .rpc();
        console.log(`Initialize ${name} account:`, tx);
      }
    });
  });

  describe("Mint", () => {
    it("Should mint 1 token", async () => {
      const mintAmount = BigInt(1_000_000_000);
      const encryptedHex = await encryptValue(mintAmount);

      const txForSim = await program.methods
        .mintTo(hexToBuffer(encryptedHex), inputType)
        .accounts({
          mint: mintKeypair.publicKey,
          account: ownerAccountKp.publicKey,
          mintAuthority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .transaction();

      const newHandle = await simulateAndGetHandle(txForSim, ownerAccountKp.publicKey);
      const [allowancePda] = getAllowancePda(newHandle!, walletKeypair.publicKey);

      const tx = await program.methods
        .mintTo(hexToBuffer(encryptedHex), inputType)
        .accounts({
          mint: mintKeypair.publicKey,
          account: ownerAccountKp.publicKey,
          mintAuthority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: allowancePda, isSigner: false, isWritable: true },
          { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false },
        ])
        .rpc();

      console.log("Mint tx:", tx);
      await new Promise(r => setTimeout(r, 3000));

      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      const handle = extractHandleFromAnchor(account.amount);
      const result = await decryptHandle(handle.toString());
      
      console.log("Balance:", result.success ? `${formatBalance(result.plaintext!)} tokens` : result.error);
      if (result.success) {
        expect(result.plaintext).to.equal("1000000000");
      }
    });
  });

  describe("Transfer", () => {
    it("Should transfer 0.25 tokens", async () => {
      const transferAmount = BigInt(250_000_000);
      const encryptedHex = await encryptValue(transferAmount);

      const txForSim = await program.methods
        .transfer(hexToBuffer(encryptedHex), inputType)
        .accounts({
          source: ownerAccountKp.publicKey,
          destination: recipientAccountKp.publicKey,
          authority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .transaction();

      const { sourceHandle, destHandle } = await simulateTransferAndGetHandles(
        txForSim, ownerAccountKp.publicKey, recipientAccountKp.publicKey
      );

      const [sourceAllowancePda] = getAllowancePda(sourceHandle!, walletKeypair.publicKey);
      const [destAllowancePda] = getAllowancePda(destHandle!, walletKeypair.publicKey);

      const tx = await program.methods
        .transfer(hexToBuffer(encryptedHex), inputType)
        .accounts({
          source: ownerAccountKp.publicKey,
          destination: recipientAccountKp.publicKey,
          authority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: sourceAllowancePda, isSigner: false, isWritable: true },
          { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false },
          { pubkey: destAllowancePda, isSigner: false, isWritable: true },
          { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false },
        ])
        .rpc();

      console.log("Transfer tx:", tx);
      await new Promise(r => setTimeout(r, 5000));

      const sourceAccount = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      const destAccount = await program.account.incoAccount.fetch(recipientAccountKp.publicKey);

      const sourceResult = await decryptHandle(extractHandleFromAnchor(sourceAccount.amount).toString());
      const destResult = await decryptHandle(extractHandleFromAnchor(destAccount.amount).toString());

      console.log("Source balance:", sourceResult.success ? `${formatBalance(sourceResult.plaintext!)} tokens` : sourceResult.error);
      console.log("Dest balance:", destResult.success ? `${formatBalance(destResult.plaintext!)} tokens` : destResult.error);
    });

    it("Should handle self-transfer", async () => {
      const encryptedHex = await encryptValue(BigInt(100_000_000));

      const tx = await program.methods
        .transfer(hexToBuffer(encryptedHex), inputType)
        .accounts({
          source: ownerAccountKp.publicKey,
          destination: ownerAccountKp.publicKey,
          authority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      console.log("Self-transfer tx:", tx);
    });
  });

  describe("Burn", () => {
    it("Should burn 0.1 tokens", async () => {
      const burnAmount = BigInt(100_000_000);
      const encryptedHex = await encryptValue(burnAmount);

      const txForSim = await program.methods
        .burn(hexToBuffer(encryptedHex), inputType)
        .accounts({
          account: ownerAccountKp.publicKey,
          mint: mintKeypair.publicKey,
          authority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .transaction();

      const newHandle = await simulateAndGetHandle(txForSim, ownerAccountKp.publicKey);
      const [allowancePda] = getAllowancePda(newHandle!, walletKeypair.publicKey);

      const tx = await program.methods
        .burn(hexToBuffer(encryptedHex), inputType)
        .accounts({
          account: ownerAccountKp.publicKey,
          mint: mintKeypair.publicKey,
          authority: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .remainingAccounts([
          { pubkey: allowancePda, isSigner: false, isWritable: true },
          { pubkey: walletKeypair.publicKey, isSigner: false, isWritable: false },
        ])
        .rpc();

      console.log("Burn tx:", tx);
      await new Promise(r => setTimeout(r, 5000));

      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      const result = await decryptHandle(extractHandleFromAnchor(account.amount).toString());
      console.log("Balance after burn:", result.success ? `${formatBalance(result.plaintext!)} tokens` : result.error);
    });
  });

  describe("Delegation", () => {
    it("Should approve delegate", async () => {
      const encryptedHex = await encryptValue(BigInt(100_000_000));

      const tx = await program.methods
        .approve(hexToBuffer(encryptedHex), inputType)
        .accounts({
          source: ownerAccountKp.publicKey,
          delegate: delegateAccountKp.publicKey,
          owner: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        } as any)
        .rpc();

      console.log("Approve tx:", tx);
      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      expect(account.delegate).to.have.property('some');
    });

    it("Should revoke delegate", async () => {
      const tx = await program.methods
        .revoke()
        .accounts({
          source: ownerAccountKp.publicKey,
          owner: walletKeypair.publicKey,
          incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
        } as any)
        .rpc();

      console.log("Revoke tx:", tx);
      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      expect(account.delegate).to.have.property('none');
    });
  });

  describe("Freeze/Thaw", () => {
    it("Should freeze account", async () => {
      const tx = await program.methods
        .freezeAccount()
        .accounts({
          account: ownerAccountKp.publicKey,
          mint: mintKeypair.publicKey,
          freezeAuthority: walletKeypair.publicKey,
        } as any)
        .rpc();

      console.log("Freeze tx:", tx);
      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      expect(account.state).to.have.property('frozen');
    });

    it("Should reject transfer from frozen account", async () => {
      const encryptedHex = await encryptValue(BigInt(50_000_000));

      try {
        await program.methods
          .transfer(hexToBuffer(encryptedHex), inputType)
          .accounts({
            source: ownerAccountKp.publicKey,
            destination: recipientAccountKp.publicKey,
            authority: walletKeypair.publicKey,
            incoLightningProgram: INCO_LIGHTNING_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          } as any)
          .rpc();
        expect.fail("Should have thrown");
      } catch (error: any) {
        expect(error.toString().toLowerCase()).to.include("frozen");
      }
    });

    it("Should thaw account", async () => {
      const tx = await program.methods
        .thawAccount()
        .accounts({
          account: ownerAccountKp.publicKey,
          mint: mintKeypair.publicKey,
          freezeAuthority: walletKeypair.publicKey,
        } as any)
        .rpc();

      console.log("Thaw tx:", tx);
      const account = await program.account.incoAccount.fetch(ownerAccountKp.publicKey);
      expect(account.state).to.have.property('initialized');
    });
  });

  describe("Summary", () => {
    it("Should display final balances", async () => {
      console.log("\n=== Final Balances ===");
      
      const accounts = [
        { name: "Owner", kp: ownerAccountKp },
        { name: "Recipient", kp: recipientAccountKp },
        { name: "Delegate", kp: delegateAccountKp },
      ];

      for (const { name, kp } of accounts) {
        const account = await program.account.incoAccount.fetch(kp.publicKey);
        const handle = extractHandleFromAnchor(account.amount);
        const result = await decryptHandle(handle.toString());
        console.log(`${name}: ${result.success ? formatBalance(result.plaintext!) : result.error} tokens`);
      }
    });
  });
});
