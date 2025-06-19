# Next.js Template

This template provides a Nextjs implementation of @inco/js sdk for encryption and re-encryption.

## Getting Started

1. Clone the repository:

```bash
git clone https://github.com/Inco-fhevm/nextjs-template.git
cd nextjs-template
```

2. Install dependencies:

```bash
npm install
```

3. Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Core Functionality

### Encryption Utilities

The project includes main functions in `src/utils/inco-lite.ts` i.e encryptValue and reencryptValue:

#### 1. encryptValue

Encrypts a numeric value for a specific contract and address:

```typescript
const encryptedData = await encryptValue({
  value: BigInt("1000"), // Value to encrypt
  address: "0x...", // User's wallet address
  contractAddress: "0x...", // Contract address
});
```

#### 2. reEncryptValue

Re-encrypts a value using a wallet client and handle:

```typescript
const decryptedValue = await reEncryptValue({
  walletClient: yourWalletClient,
  handle: "0x...", // Encryption handle
});
```
