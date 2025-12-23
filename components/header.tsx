import { ConnectButton } from "@rainbow-me/rainbowkit";
import Image from "next/image";

const Header = () => {
  return (
    <div className="flex items-center justify-between">
      <Image src="/inco.svg" alt="Inco" width={139} height={40} />
      <ConnectButton />
    </div>
  );
};

export default Header;
