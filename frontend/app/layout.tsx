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
        <div className="fixed inset-0 w-full h-full mental-health-bg z-[-20] min-w-[850px]"></div>
        <main className="flex flex-col max-w-screen-lg mx-auto pb-20 min-w-[850px]">
          <nav className="flex w-full px-3 md:px-0 h-fit py-10 justify-between items-center">
            <Image
              src="/logo.svg"
              alt="Mental Health Survey Logo"
              width={120}
              height={120}
              className="rounded-full"
            />
            <h1 className="text-3xl font-bold text-white">Encrypted Mental Health Survey</h1>
          </nav>
          <Providers>{children}</Providers>
        </main>
      </body>
    </html>
  );
}

