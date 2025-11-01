import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Headers removed to allow wallet resources (Coinbase, etc.) to load
  // FHEVM requires COEP for SharedArrayBuffer support, but it blocks wallet resources
  // Re-enable COEP header when FHEVM encryption/decryption is implemented:
  // headers() {
  //   return Promise.resolve([
  //     {
  //       source: '/',
  //       headers: [
  //         {
  //           key: 'Cross-Origin-Embedder-Policy',
  //           value: 'require-corp',
  //         },
  //       ],
  //     },
  //   ]);
  // }
};

export default nextConfig;

