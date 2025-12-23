"use client";

import Header from "@/components/header";
import Padder from "@/components/padder";
import EncryptedInput from "@/components/encrypted-input";
import Balance from "@/components/balance";

const Page = () => {
  return (
    <Padder>
      <Header />
      <div className="max-w-md mx-auto">
        <EncryptedInput />
        <Balance />
      </div>
    </Padder>
  );
};

export default Page;
