"use client";

import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { sepolia, hardhat } from "wagmi/chains";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import "@rainbow-me/rainbowkit/styles.css";

// WalletConnect Project ID from environment variable
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "e08e99d213c331aa0fd00f625de06e66";
if (!projectId || projectId === "YOUR_PROJECT_ID") {
  console.warn("WalletConnect Project ID not configured. Some wallet features may not work.");
} else {
  console.log("WalletConnect Project ID loaded:", projectId.substring(0, 8) + "...");
}

// For local development, suppress WalletConnect/Reown analytics errors
if (typeof window !== "undefined") {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const errorMessage = args[0]?.toString() || "";
    if (
      errorMessage.includes("not found on Allowlist") ||
      errorMessage.includes("Origin") ||
      errorMessage.includes("Failed to fetch") ||
      errorMessage.includes("403") ||
      errorMessage.includes("Analytics SDK") ||
      errorMessage.includes("Reown Config")
    ) {
      // Suppress WalletConnect/Reown related errors in development
      return;
    }
    originalError.apply(console, args);
  };
}

const config = getDefaultConfig({
  appName: "Encrypted Mental Health Survey",
  projectId: projectId || "00000000000000000000000000000000",
  chains: [hardhat, sepolia],
  ssr: true,
});

const queryClient = new QueryClient();

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

