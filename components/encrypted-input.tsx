import { useState } from "react";
import { encryptValue } from "@/utils/inco";

const EncryptedInput = () => {
  const [value, setValue] = useState("");

  const [encryptedValue, setEncryptedValue] = useState<string>("");

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    const encryptedVal = await encryptValue({
      value: BigInt(e.target.value),
      address: "0x1234567890123456789012345678901234567890",
      contractAddress: "0x1234567890123456789012345678901234567890",
    });
    setEncryptedValue(encryptedVal);
  };

  console.log("encryptedValue", encryptedValue);

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">Encrypted Input</h2>
      <input
        type="text"
        className="w-full p-2 border border-gray-300 rounded-md"
        onChange={handleChange}
      />

      {encryptedValue && <p>Encrypted Value: {encryptedValue}</p>}
    </div>
  );
};

export default EncryptedInput;
