"use client";

import Header from "@/components/header";
import Padder from "@/components/padder";
import EncryptedInput from "@/components/encrypted-input";
import Balance from "@/components/balance";
import AttestedComputeCard from "@/components/attested-compute";

const Page = () => {
  return (
    <Padder>
      <Header />
      <div className="max-w-md mx-auto">
        <EncryptedInput />
        <Balance />
        <AttestedComputeCard />
      </div>
    </Padder>
  );
};

export default Page;
