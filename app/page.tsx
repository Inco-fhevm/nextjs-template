"use client";

import Header from "@/components/header";
import Padder from "@/components/padder";
import EncryptedInput from "@/components/encrypted-input";

const Page = () => {
  return (
    <Padder>
      <Header />
      <EncryptedInput />
    </Padder>
  );
};

export default Page;
