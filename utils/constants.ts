import { PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

export const PROGRAM_ID = new PublicKey(
  "7PkBc98v6bKkX8oc8Wmce6HNR5BiEt1YcRFB4DLsrPW8"
);

// Discriminators from IDL (for getProgramAccounts filters)
export const INCO_MINT_DISCRIMINATOR = [254, 129, 245, 169, 202, 143, 198, 4];
export const INCO_ACCOUNT_DISCRIMINATOR = [18, 233, 131, 18, 230, 173, 249, 89];

// Fetch user's IncoMint (where they are mint_authority)
export const fetchUserMint = async (
  connection: Connection,
  wallet: PublicKey
): Promise<{ pubkey: PublicKey; data: Buffer } | null> => {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(Buffer.from(INCO_MINT_DISCRIMINATOR)),
        },
      },
      { memcmp: { offset: 9, bytes: wallet.toBase58() } },
    ],
  });
  return accounts.length > 0
    ? { pubkey: accounts[0].pubkey, data: accounts[0].account.data as Buffer }
    : null;
};

// Fetch user's IncoAccount for a specific mint
export const fetchUserTokenAccount = async (
  connection: Connection,
  wallet: PublicKey,
  mint: PublicKey
): Promise<{ pubkey: PublicKey; data: Buffer } | null> => {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(Buffer.from(INCO_ACCOUNT_DISCRIMINATOR)),
        },
      },
      { memcmp: { offset: 8, bytes: mint.toBase58() } },
      { memcmp: { offset: 40, bytes: wallet.toBase58() } },
    ],
  });
  return accounts.length > 0
    ? { pubkey: accounts[0].pubkey, data: accounts[0].account.data as Buffer }
    : null;
};
