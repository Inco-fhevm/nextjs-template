import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import EncryptedInput from "./encrypted-input";

const mocks = vi.hoisted(() => ({
  address: "0x123" as string | undefined,
  encryptValue: vi.fn(),
  getFee: vi.fn().mockResolvedValue(BigInt(0)),
}));

vi.mock("wagmi", () => ({ useAccount: () => ({ address: mocks.address }) }));
vi.mock("@/utils/inco", () => mocks);
vi.mock("./mint", () => ({
  default: ({ encryptedValue }: { encryptedValue: string }) => (
    <button data-ciphertext={encryptedValue}>Mint cUSDC</button>
  ),
}));

function deferred() {
  let resolve!: (value: `0x${string}`) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<`0x${string}`>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

let renderer: ReactTestRenderer;

function encryptButton() {
  return renderer.root.findAllByType("button").find((button) =>
    ["Encrypt", "Encrypting..."].includes(button.props.children),
  )!;
}

function ciphertexts() {
  return renderer.root.findAllByType("button")
    .filter((button) => button.props["data-ciphertext"])
    .map((button) => button.props["data-ciphertext"]);
}

async function changeAmount(value: string) {
  await act(async () => {
    renderer.root.findByType("input").props.onChange({ target: { value } });
  });
}

async function startEncryption() {
  await act(async () => { void encryptButton().props.onClick(); });
}

beforeEach(async () => {
  vi.clearAllMocks();
  mocks.encryptValue.mockReset();
  mocks.address = "0x123";
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
    .IS_REACT_ACT_ENVIRONMENT = true;
  await act(async () => { renderer = create(<EncryptedInput />); });
});

afterEach(async () => {
  await act(async () => { renderer.unmount(); });
});

describe("pending amount encryption", () => {
  it("does not restore the previous amount's ciphertext after an edit", async () => {
    const pending = deferred();
    mocks.encryptValue.mockReturnValueOnce(pending.promise);
    await changeAmount("1");
    await startEncryption();
    await changeAmount("2");
    await act(async () => { pending.resolve("0x01"); });

    expect(ciphertexts()).toEqual([]);
    expect(renderer.root.findByType("input").props.value).toBe("2");
    expect(encryptButton().props.disabled).toBe(false);
  });

  it("keeps the latest ciphertext when the older request resolves last", async () => {
    const oldRequest = deferred();
    const latestRequest = deferred();
    mocks.encryptValue.mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(latestRequest.promise);
    await changeAmount("1");
    await startEncryption();
    await changeAmount("2");
    expect(encryptButton().props.disabled).toBe(false);
    await startEncryption();
    await act(async () => { latestRequest.resolve("0x02"); });
    expect(ciphertexts()).toEqual(["0x02"]);
    await act(async () => { oldRequest.resolve("0x01"); });
    expect(ciphertexts()).toEqual(["0x02"]);
    expect(mocks.encryptValue.mock.calls[1][0].value).toBe(BigInt("2000000000000000000"));
  });

  it("does not clear the latest request's loading state when the old one settles", async () => {
    const oldRequest = deferred();
    const latestRequest = deferred();
    mocks.encryptValue.mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(latestRequest.promise);
    await changeAmount("1");
    await startEncryption();
    await changeAmount("2");
    await startEncryption();
    await act(async () => { oldRequest.resolve("0x01"); });
    expect(encryptButton().props.children).toBe("Encrypting...");
    expect(ciphertexts()).toEqual([]);
    await act(async () => { latestRequest.resolve("0x02"); });
    expect(encryptButton().props.children).toBe("Encrypt");
    expect(ciphertexts()).toEqual(["0x02"]);
  });

  it("discards a pending response when the wallet account changes", async () => {
    const pending = deferred();
    mocks.encryptValue.mockReturnValueOnce(pending.promise);
    await changeAmount("1");
    await startEncryption();
    await act(async () => {
      mocks.address = "0x456";
      renderer.update(<EncryptedInput />);
    });
    await act(async () => { pending.resolve("0x01"); });
    expect(ciphertexts()).toEqual([]);
    expect(renderer.root.findByType("input").props.value).toBe("");
  });
});
