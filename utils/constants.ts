import { PublicKey } from "@solana/web3.js";
// import { ENCRYPTION_CONSTANTS } from "@inco/solana-sdk";

export const PROGRAM_ID = new PublicKey(
  "7PkBc98v6bKkX8oc8Wmce6HNR5BiEt1YcRFB4DLsrPW8"
);
export const INCO_BASE_PROGRAM_ID = new PublicKey(
  "5sjEbPiqgZrYwR31ahR6Uk9wf5awoX61YGg7jExQSwaj"
);

// Instruction discriminators
export const INITIALIZE_DISCRIMINATOR = [175, 175, 109, 31, 13, 152, 155, 237];
export const MINT_DISCRIMINATOR = [51, 57, 225, 47, 182, 146, 137, 166];
