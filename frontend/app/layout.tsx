import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import Image from "next/image";

export const metadata: Metadata = {
  title: "Encrypted Mental Health Survey",
  description: "Privacy-preserving mental health questionnaire using FHEVM",
  icons: {
    icon: "/logo.svg",
    apple: "/logo.svg",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`mental-health-bg text-foreground antialiased`}>
        {/* 背景装饰 */}
        <div className="fixed inset-0 w-full h-full mental-health-bg z-[-20] min-w-[850px] overflow-hidden">
          <div className="deco-circle w-64 h-64 bg-white/10 -top-10 -left-20" />
          <div className="deco-circle w-80 h-80 bg-purple-300/10 top-1/3 -right-20" style={{animationDelay: '2s'}} />
          <div className="deco-circle w-48 h-48 bg-blue-300/10 bottom-20 left-1/4" style={{animationDelay: '4s'}} />
          <div className="deco-blob w-72 h-72 bg-pink-300/10 bottom-1/4 right-20" />
        </div>
        
        <main className="flex flex-col max-w-screen-lg mx-auto pb-20 min-w-[850px] relative z-10">
          <nav className="flex w-full px-3 md:px-0 h-fit py-10 justify-between items-center">
            <Image
              src="/logo.svg"
              alt="Mental Health Survey Logo"
              width={120}
              height={120}
              className="rounded-full hover:scale-105 transition-transform duration-300"
            />
            <div className="text-center">
              <h1 className="text-3xl font-bold text-white drop-shadow-lg">Encrypted Mental Health Survey</h1>
              <p className="text-white/70 text-sm mt-1">🔒 Privacy-First • Blockchain Secured</p>
            </div>
            <div className="glass px-4 py-2 rounded-full">
              <span className="text-white/90 text-sm font-medium flex items-center gap-2">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                Secure
              </span>
            </div>
          </nav>
          <Providers>{children}</Providers>
          <footer className="mt-12 text-center">
            <div className="glass inline-block px-6 py-3 rounded-full">
              <p className="text-white/60 text-sm">✨ Powered by FHEVM Encryption</p>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}

