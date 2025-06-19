"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useWeb3Modal } from "@web3modal/wagmi/react";
import { useEffect, useState } from "react";
import EncryptedTokenDashboard from "@/components/encrypted-token-dashboard";
import Image from "next/image";

export default function Home() {
  const { isConnected, address } = useAccount();
  const { open } = useWeb3Modal();
  const { disconnectAsync } = useDisconnect();
  const [mounted, setMounted] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleDisconnect = async () => {
    try {
      await disconnectAsync();
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Disconnect error:", error);
    }
  };

  const handleConnect = () => {
    try {
      open();
      setMobileMenuOpen(false);
    } catch (error) {
      console.error("Connect error:", error);
    }
  };

  if (!mounted) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-white/60">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-7xl mx-auto px-2 py-6">
        {/* Desktop Header */}
        <header className="hidden sm:flex items-center justify-between mb-16">
          <div className="flex items-center gap-2">
            <IncoMainLogo />
            <h1 className="text-2xl font-medium font-mono">Inco Template</h1>
          </div>

          {isConnected ? (
            <div className="flex items-center gap-4 bg-white/5 border border-white/10 px-4 py-2">
              <span className="text-sm font-mono">
                {address?.slice(0, 6)}...{address?.slice(-4)}
              </span>
              <button
                onClick={handleDisconnect}
                className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-colors"
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="px-6 py-2.5 bg-inco-blue text-white hover:bg-inco-blue/90 transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </header>

        {/* Mobile Header */}
        <header className="sm:hidden mb-16">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <IncoMainLogo />
              <h1 className="text-xl font-medium font-mono">Inco Template</h1>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 hover:bg-white/10 transition-colors"
              aria-label="Toggle menu"
            >
              <HamburgerIcon isOpen={mobileMenuOpen} />
            </button>
          </div>

          {/* Mobile Menu Dropdown */}
          {mobileMenuOpen && (
            <div className="mt-4 bg-white/5 border border-white/10 rounded-lg p-4">
              {isConnected ? (
                <div className="space-y-3">
                  <div className="text-sm font-mono text-white/80 pb-2 border-b border-white/10">
                    Connected Wallet
                  </div>
                  <div className="text-xs font-mono break-all text-white/60">
                    {address}
                  </div>
                  <button
                    onClick={handleDisconnect}
                    className="w-full px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 text-sm transition-colors rounded"
                  >
                    Disconnect Wallet
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="text-sm font-mono text-white/80 pb-2 border-b border-white/10">
                    Wallet Connection
                  </div>
                  <button
                    onClick={handleConnect}
                    className="w-full px-4 py-2.5 bg-inco-blue text-white hover:bg-inco-blue/90 transition-colors rounded"
                  >
                    Connect Wallet
                  </button>
                </div>
              )}
            </div>
          )}
        </header>

        {isConnected ? (
          <EncryptedTokenDashboard />
        ) : (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="text-center max-w-md px-4 sm:px-0">
              <div className="flex w-full justify-center mb-6">
                <Image
                  src="https://cdn.prod.website-files.com/671156d33ac264346e223043/675a2a83d4ac40cf1352048c_logo%20(24).png"
                  alt="Wallet"
                  width={160}
                  height={160}
                />
              </div>

              <h2 className="text-xl sm:text-2xl mb-3">Connect Your Wallet</h2>
              <p className="text-white/60 mb-8 leading-relaxed font-mono max-w-xs text-base sm:text-lg mx-auto">
                Connect your wallet to access encrypted token features
              </p>
              <button
                onClick={handleConnect}
                className="px-6 sm:px-8 py-2.5 sm:py-3 bg-inco-blue text-white hover:bg-inco-blue/90 transition-colors text-sm sm:text-base"
              >
                Connect Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const IncoMainLogo = () => (
  <svg
    width="30"
    height="30"
    viewBox="0 0 200 200"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="w-6 h-6 sm:w-7 sm:h-7"
  >
    <path
      d="M0 32C0 14.3269 14.2886 0 31.9145 0H167.551C185.177 0 199.466 14.3269 199.466 32V168C199.466 185.673 185.177 200 167.551 200H31.9145C14.2886 200 0 185.673 0 168V32Z"
      fill="#3673F5"
    />
    <path d="M37.8984 138L58.0045 62H79.7858L59.68 138H37.8984Z" fill="white" />
    <path
      d="M79.7861 138L99.8931 62H121.674L101.568 138H79.7861Z"
      fill="white"
    />
    <path
      d="M121.674 138L141.78 62H163.562L143.456 138H121.674Z"
      fill="white"
    />
  </svg>
);

const HamburgerIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="transition-transform duration-200"
  >
    <path
      d={isOpen ? "M18 6L6 18" : "M3 12h18"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-all duration-200"
    />
    {!isOpen && (
      <>
        <path
          d="M3 6h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M3 18h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    )}
    {isOpen && (
      <path
        d="M6 6l12 12"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    )}
  </svg>
);