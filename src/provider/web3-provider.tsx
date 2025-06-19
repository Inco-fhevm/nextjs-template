"use client";

import React from "react";
import { createWeb3Modal } from "@web3modal/wagmi/react";
import { defaultWagmiConfig } from "@web3modal/wagmi/react/config";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, useEffect, ReactNode } from "react";
import { baseSepolia } from "wagmi/chains";

import type { Config, State } from "wagmi";

const projectId = "be36d80bd82aef7bdb958bb467c3e570";

const initializeWeb3Modal = (): Config => {
  try {
    const metadata = {
      name: "Inco Nextjs Template",
      description: "Inco Nextjs Template",
      url: "https://www.inco.org",
      icons: ["https://cdn.prod.website-files.com/671156d33ac264346e223043/675a2a83d4ac40cf1352048c_logo%20(24).png"],
    };

    const chains = [baseSepolia] as const;

    const wagmiConfig = defaultWagmiConfig({
      chains,
      projectId,
      metadata,
    });

    createWeb3Modal({
      wagmiConfig,
      projectId,
      enableAnalytics: true,
      themeMode: "dark",
      chainImages: {
        [baseSepolia.id]: "https://images.mirror-media.xyz/publication-images/cgqxxPdUFBDjgKna_dDir.png?height=1200&width=1200",
      },
    });

    console.log("Web3Modal initialized successfully");
    return wagmiConfig;
  } catch (error) {
    console.error("Failed to initialize Web3Modal:", error);
    throw error;
  }
};

interface Web3ProviderProps {
  children: ReactNode;
  initialState?: State;
}

export function Web3Provider({ children, initialState }: Web3ProviderProps) {
  const [queryClient] = useState(() => new QueryClient());
  const [wagmiConfig, setWagmiConfig] = useState<Config | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!initialized) {
      try {
        const config = initializeWeb3Modal();
        setWagmiConfig(config);
        setInitialized(true);
      } catch (err) {
        console.error("Web3Provider initialization error:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
      }
    }
  }, [initialized]);

  const renderLoadingState = () => (
    <div className="bg-gray-900 min-h-screen flex items-center justify-center text-white">
      <div className="text-center">
        <div className="mx-auto mb-4 w-12 h-12 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-xl mb-2">
          {error ? "Wallet Connection Error" : "Initializing Wallet Connection..."}
        </p>
        {error && (
          <div className="bg-red-900/20 border border-red-500 text-red-400 p-4 rounded-lg mt-4 flex items-center justify-center">
            <span className="mr-2">⚠️</span>
            {error.message}
          </div>
        )}
      </div>
    </div>
  );

  if (error) {
    return renderLoadingState();
  }

  if (!initialized || !wagmiConfig) {
    return renderLoadingState();
  }

  return (
    <WagmiProvider config={wagmiConfig} initialState={initialState}>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}