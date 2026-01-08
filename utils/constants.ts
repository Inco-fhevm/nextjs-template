import { PublicKey, Connection } from "@solana/web3.js";
import bs58 from "bs58";

export const PROGRAM_ID = new PublicKey(
  "7PkBc98v6bKkX8oc8Wmce6HNR5BiEt1YcRFB4DLsrPW8"
);
export const INCO_BASE_PROGRAM_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
);

// Discriminators from IDL
export const INCO_MINT_DISCRIMINATOR = [254, 129, 245, 169, 202, 143, 198, 4];
export const INCO_ACCOUNT_DISCRIMINATOR = [18, 233, 131, 18, 230, 173, 249, 89];
export const INITIALIZE_MINT_DISCRIMINATOR = [
  209, 42, 195, 4, 129, 85, 209, 44,
];
export const INITIALIZE_ACCOUNT_DISCRIMINATOR = [
  74, 115, 99, 93, 197, 69, 103, 7,
];
export const MINT_TO_DISCRIMINATOR = [241, 34, 48, 186, 37, 179, 123, 192];

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
      { memcmp: { offset: 9, bytes: wallet.toBase58() } }, // discriminator(8) + option_tag(1)
    ],
  });
  return accounts.length > 0
    ? { pubkey: accounts[0].pubkey, data: accounts[0].account.data as Buffer }
    : null;
};

// Fetch user's IncoAccount (where they are owner) for a specific mint
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
      { memcmp: { offset: 40, bytes: wallet.toBase58() } }, // discriminator(8) + mint(32)
    ],
  });
  return accounts.length > 0
    ? { pubkey: accounts[0].pubkey, data: accounts[0].account.data as Buffer }
    : null;
};

// Fetch all user's IncoAccounts (token accounts they own)
export const fetchAllUserTokenAccounts = async (
  connection: Connection,
  wallet: PublicKey
): Promise<Array<{ pubkey: PublicKey; mint: PublicKey; data: Buffer }>> => {
  const accounts = await connection.getProgramAccounts(PROGRAM_ID, {
    filters: [
      {
        memcmp: {
          offset: 0,
          bytes: bs58.encode(Buffer.from(INCO_ACCOUNT_DISCRIMINATOR)),
        },
      },
      { memcmp: { offset: 40, bytes: wallet.toBase58() } }, // owner at offset 40
    ],
  });
  return accounts.map((acc) => ({
    pubkey: acc.pubkey,
    mint: new PublicKey(acc.account.data.slice(8, 40)),
    data: acc.account.data as Buffer,
  }));
};
