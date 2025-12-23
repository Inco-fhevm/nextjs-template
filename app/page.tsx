"use client";

import Header from "@/components/header";
import Padder from "@/components/padder";
import EncryptedInput from "@/components/encrypted-input";
import Balance from "@/components/balance";

const Page = () => {
  return (
    <Padder>
      <Header />
      <EncryptedInput />
      <Balance />
    </Padder>
  );
};

export default Page;
