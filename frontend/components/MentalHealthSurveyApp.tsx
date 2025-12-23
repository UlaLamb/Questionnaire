"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, useReadContract, usePublicClient } from "wagmi";
import { ethers, Contract } from "ethers";
import { MentalHealthSurveyAddresses } from "@/abi/MentalHealthSurveyAddresses";
import { MentalHealthSurveyABI } from "@/abi/MentalHealthSurveyABI";
import { useFhevm } from "@/fhevm/useFhevm";
import { useEthersSigner } from "@/hooks/useEthersSigner";
import { useInMemoryStorage } from "@/hooks/useInMemoryStorage";
import { FhevmDecryptionSignature } from "@/fhevm/FhevmDecryptionSignature";

type SurveyForm = {
  stressLevel: string;
  anxietyLevel: string;
  moodScore: string;
  sleepQuality: string;
  energyLevel: string;
};

type DecryptedSurvey = {
  stressLevel: number;
  anxietyLevel: number;
  moodScore: number;
  sleepQuality: number;
  energyLevel: number;
  timestamp: number;
};

export function MentalHealthSurveyApp() {
  const { address, isConnected, chainId } = useAccount();
  const { storage } = useInMemoryStorage();
  const signerPromise = useEthersSigner({ chainId });
  const publicClient = usePublicClient();
  
  // Get provider from wagmi
  const provider = useMemo(() => {
    if (typeof window === "undefined" || !window.ethereum) return undefined;
    return window.ethereum as ethers.Eip1193Provider;
  }, []);

  // Initialize FHEVM instance
  const { instance: fhevmInstance, status: fhevmStatus } = useFhevm({
    provider,
    chainId,
    enabled: isConnected && !!chainId,
  });

  const [form, setForm] = useState<SurveyForm>({
    stressLevel: "",
    anxietyLevel: "",
    moodScore: "",
    sleepQuality: "",
    energyLevel: "",
  });

  const [surveyCount, setSurveyCount] = useState<bigint>(0n);
  const [decryptedSurveys, setDecryptedSurveys] = useState<DecryptedSurvey[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const contractAddress = useMemo(() => {
    if (!chainId) return undefined;
    const addr = MentalHealthSurveyAddresses[chainId.toString() as keyof typeof MentalHealthSurveyAddresses];
    return addr?.address;
  }, [chainId]);

  const { data: count, error: readError, refetch: refetchCount } = useReadContract({
    address: contractAddress,
    abi: MentalHealthSurveyABI.abi,
    functionName: "getSurveyCount",
    args: address ? [address] : undefined,
    query: {
      enabled: !!address && !!contractAddress && contractAddress !== "0x0000000000000000000000000000000000000000",
      retry: 1,
    },
  });

  useEffect(() => {
    if (readError) {
      console.error("Contract read error:", readError);
      setMessage(`Error reading contract: ${readError.message}`);
    }
  }, [readError]);

  useEffect(() => {
    if (count !== undefined) {
      setSurveyCount(count);
    }
  }, [count]);

  // Note: Transaction confirmation is handled in handleSubmit

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !contractAddress) {
      setMessage("Please connect your wallet");
      return;
    }

    if (!fhevmInstance || fhevmStatus !== "ready") {
      setMessage("FHEVM encryption service is not ready. Please wait...");
      return;
    }

    if (!signerPromise) {
      setMessage("Wallet signer is not available");
      return;
    }

    setLoading(true);
    setMessage("");

    // Capture current chainId and contractAddress at the start
    const initialChainId = chainId;
    const initialContractAddress = contractAddress;

    try {
      setMessage("Encrypting survey data...");
      
      // Parse form values
      const stressLevel = parseInt(form.stressLevel);
      const anxietyLevel = parseInt(form.anxietyLevel);
      const moodScore = parseInt(form.moodScore);
      const sleepQuality = parseInt(form.sleepQuality);
      const energyLevel = parseInt(form.energyLevel);

      // Validate values
      if (
        isNaN(stressLevel) || isNaN(anxietyLevel) || isNaN(moodScore) ||
        isNaN(sleepQuality) || isNaN(energyLevel) ||
        stressLevel < 0 || stressLevel > 100 ||
        anxietyLevel < 0 || anxietyLevel > 100 ||
        moodScore < 0 || moodScore > 100 ||
        sleepQuality < 0 || sleepQuality > 100 ||
        energyLevel < 0 || energyLevel > 100
      ) {
        setMessage("Please enter valid values between 0 and 100");
        setLoading(false);
        return;
      }

      // Check if chain or contract address changed before encryption
      if (chainId !== initialChainId || contractAddress !== initialContractAddress) {
        setMessage("Chain or contract changed. Please try again.");
        setLoading(false);
        return;
      }

      // Create encrypted input
      const input = fhevmInstance.createEncryptedInput(contractAddress, address);
      input.add32(BigInt(stressLevel));
      input.add32(BigInt(anxietyLevel));
      input.add32(BigInt(moodScore));
      input.add32(BigInt(sleepQuality));
      input.add32(BigInt(energyLevel));

      // Encrypt with retry logic (this is CPU-intensive and may fail due to relayer issues)
      let encrypted;
      let retryCount = 0;
      const maxRetries = 3;
      
      while (retryCount < maxRetries) {
        try {
          setMessage(`Encrypting survey data (attempt ${retryCount + 1}/${maxRetries})...`);
          
          // Let the browser repaint before running 'input.encrypt()' (CPU-costly)
          await new Promise((resolve) => setTimeout(resolve, 100));
          
          encrypted = await input.encrypt();
          console.log("FHE encryption successful");
          break;
        } catch (encryptError: any) {
          retryCount++;
          console.warn(`FHE encryption attempt ${retryCount} failed:`, encryptError.message);
          
          if (retryCount >= maxRetries) {
            const errorMsg = encryptError.message || "Unknown encryption error";
            if (errorMsg.includes("Bad JSON") || errorMsg.includes("Relayer")) {
              setMessage(`Relayer service error. Please check your network connection and try again later. Error: ${errorMsg}`);
            } else {
              setMessage(`Encryption failed after ${maxRetries} attempts: ${errorMsg}`);
            }
            setLoading(false);
            return;
          }
          
          // Wait before retry (exponential backoff)
          const waitTime = Math.pow(2, retryCount) * 1000; // 2s, 4s, 8s
          setMessage(`Encryption failed, retrying in ${waitTime/1000}s...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
      
      if (!encrypted) {
        setMessage("Encryption failed. Please try again.");
        setLoading(false);
        return;
      }

      // Check if chain or contract address changed after encryption
      if (chainId !== initialChainId || contractAddress !== initialContractAddress) {
        setMessage("Chain or contract changed during encryption. Please try again.");
        setLoading(false);
        return;
      }

      setMessage("Submitting encrypted survey to blockchain...");

      // Get signer
      const signer = await signerPromise;
      if (!signer) {
        setMessage("Failed to get wallet signer");
        setLoading(false);
        return;
      }

      // Create contract instance and submit
      const contract = new Contract(
        contractAddress,
        MentalHealthSurveyABI.abi,
        signer
      );

      setMessage("Please confirm the transaction in your wallet...");

      // Submit transaction - this will trigger wallet popup
      const tx = await contract.submitSurvey(
        encrypted.handles[0],
        encrypted.handles[1],
        encrypted.handles[2],
        encrypted.handles[3],
        encrypted.handles[4],
        encrypted.inputProof
      );

      setMessage("Transaction submitted! Waiting for confirmation...");

      // Wait for transaction confirmation
      const receipt = await tx.wait();

      setMessage(`Survey submitted and confirmed! Transaction hash: ${receipt.hash}`);
      
      // Reset form
      setForm({
        stressLevel: "",
        anxietyLevel: "",
        moodScore: "",
        sleepQuality: "",
        energyLevel: "",
      });

      // Refresh survey count after a short delay
      setTimeout(() => {
        refetchCount();
      }, 1000);
    } catch (error: any) {
      console.error("Submit error:", error);
      setMessage(error?.message || "Failed to submit survey");
    } finally {
      setLoading(false);
    }
  };

  const handleDecrypt = async (index: number) => {
    if (!address || !contractAddress) {
      setMessage("Please connect your wallet");
      return;
    }

    if (!fhevmInstance || fhevmStatus !== "ready") {
      setMessage("FHEVM decryption service is not ready. Please wait...");
      return;
    }

    if (!signerPromise) {
      setMessage("Wallet signer is not available");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      setMessage("Retrieving encrypted survey data...");

      if (!publicClient || !contractAddress) {
        setMessage("Public client or contract address not available");
        setLoading(false);
        return;
      }

      // Get encrypted handles from contract
      const [stressLevelHandle, anxietyLevelHandle, moodScoreHandle, sleepQualityHandle, energyLevelHandle, timestamp] = await Promise.all([
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getStressLevel",
          args: [address!, BigInt(index)],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getAnxietyLevel",
          args: [address!, BigInt(index)],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getMoodScore",
          args: [address!, BigInt(index)],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getSleepQuality",
          args: [address!, BigInt(index)],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getEnergyLevel",
          args: [address!, BigInt(index)],
        }),
        publicClient.readContract({
          address: contractAddress,
          abi: MentalHealthSurveyABI.abi,
          functionName: "getSurveyTimestamp",
          args: [address!, BigInt(index)],
        }),
      ]);

      if (!stressLevelHandle || !anxietyLevelHandle || !moodScoreHandle || !sleepQualityHandle || !energyLevelHandle) {
        setMessage("Failed to retrieve encrypted survey data");
        setLoading(false);
        return;
      }

      setMessage("Decrypting survey data...");

      // Get or create decryption signature
      const signer = await signerPromise;
      if (!signer) {
        setMessage("Failed to get wallet signer");
        setLoading(false);
        return;
      }

      const decryptionSignature = await FhevmDecryptionSignature.loadOrSign(
        fhevmInstance,
        [contractAddress],
        signer,
        storage
      );

      if (!decryptionSignature) {
        setMessage("Failed to create decryption signature");
        setLoading(false);
        return;
      }

      // Prepare handle-contract pairs for decryption
      const handleContractPairs = [
        { handle: stressLevelHandle as string, contractAddress },
        { handle: anxietyLevelHandle as string, contractAddress },
        { handle: moodScoreHandle as string, contractAddress },
        { handle: sleepQualityHandle as string, contractAddress },
        { handle: energyLevelHandle as string, contractAddress },
      ];

      // Decrypt all values at once using userDecrypt
      // Note: signature should not have 0x prefix, and timestamps should be numbers
      const cleanSignature = decryptionSignature.signature.replace(/^0x/, "");
      
      const decryptedResults = await fhevmInstance.userDecrypt(
        handleContractPairs,
        decryptionSignature.privateKey,
        decryptionSignature.publicKey,
        cleanSignature,
        decryptionSignature.contractAddresses,
        decryptionSignature.userAddress,
        decryptionSignature.startTimestamp,
        decryptionSignature.durationDays
      );

      // Extract decrypted values from results
      const stressLevel = decryptedResults[stressLevelHandle as string];
      const anxietyLevel = decryptedResults[anxietyLevelHandle as string];
      const moodScore = decryptedResults[moodScoreHandle as string];
      const sleepQuality = decryptedResults[sleepQualityHandle as string];
      const energyLevel = decryptedResults[energyLevelHandle as string];

      // Update decrypted surveys
      const decryptedSurvey: DecryptedSurvey = {
        stressLevel: Number(stressLevel),
        anxietyLevel: Number(anxietyLevel),
        moodScore: Number(moodScore),
        sleepQuality: Number(sleepQuality),
        energyLevel: Number(energyLevel),
        timestamp: timestamp ? Number(timestamp) : Date.now(),
      };

      setDecryptedSurveys((prev) => {
        const updated = [...prev];
        updated[index] = decryptedSurvey;
        return updated;
      });

      setMessage(`Survey #${index + 1} decrypted successfully!`);
    } catch (error: any) {
      console.error("Decrypt error:", error);
      setMessage(error?.message || "Failed to decrypt survey");
    } finally {
      setLoading(false);
    }
  };

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  return (
    <div className="w-full max-w-4xl mx-auto px-4">
      <div className="flex justify-end mb-6">
        <ConnectButton />
      </div>

      {!isConnected ? (
        <div className="bg-white rounded-2xl shadow-xl p-8 text-center card-hover">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">Connect Your Wallet</h2>
          <p className="text-gray-600 mb-6">
            Please connect your wallet to start using the Encrypted Mental Health Survey
          </p>
          <div className="flex justify-center gap-4 mb-6">
            <div className="p-3 bg-purple-50 rounded-xl text-center">
              <div className="text-2xl">🔐</div>
              <div className="text-xs text-gray-500 mt-1">Encrypted</div>
            </div>
            <div className="p-3 bg-blue-50 rounded-xl text-center">
              <div className="text-2xl">⛓️</div>
              <div className="text-xs text-gray-500 mt-1">On-Chain</div>
            </div>
            <div className="p-3 bg-green-50 rounded-xl text-center">
              <div className="text-2xl">🛡️</div>
              <div className="text-xs text-gray-500 mt-1">Private</div>
            </div>
          </div>
          <ConnectButton />
        </div>
      ) : (
        <>
          <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Submit Mental Health Survey</h2>
                <p className="text-gray-500 text-sm">Your responses are encrypted and stored securely</p>
              </div>
            </div>
            <div className="mb-5 p-3 bg-green-50 rounded-xl border border-green-200 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              <span className="text-green-700 text-sm">🔐 Only you can decrypt your data</span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  😰 Stress Level (0-100)
                </label>
                <input
                  type="number"
                  name="stressLevel"
                  min="0"
                  max="100"
                  required
                  value={form.stressLevel}
                  onChange={onChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 input-focus"
                  placeholder="Enter stress level (0-100)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  😟 Anxiety Level (0-100)
                </label>
                <input
                  type="number"
                  name="anxietyLevel"
                  min="0"
                  max="100"
                  required
                  value={form.anxietyLevel}
                  onChange={onChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 input-focus"
                  placeholder="Enter anxiety level (0-100)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  😊 Mood Score (0-100)
                </label>
                <input
                  type="number"
                  name="moodScore"
                  min="0"
                  max="100"
                  required
                  value={form.moodScore}
                  onChange={onChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 input-focus"
                  placeholder="Enter mood score (0-100)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  😴 Sleep Quality (0-100)
                </label>
                <input
                  type="number"
                  name="sleepQuality"
                  min="0"
                  max="100"
                  required
                  value={form.sleepQuality}
                  onChange={onChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 input-focus"
                  placeholder="Enter sleep quality (0-100)"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  ⚡ Energy Level (0-100)
                </label>
                <input
                  type="number"
                  name="energyLevel"
                  min="0"
                  max="100"
                  required
                  value={form.energyLevel}
                  onChange={onChange}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 input-focus"
                  placeholder="Enter energy level (0-100)"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-purple-600 to-pink-600 text-white py-4 px-6 rounded-xl font-semibold hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed btn-glow"
              >
                {loading ? "🔄 Processing..." : "🔐 Submit Encrypted Survey"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-2xl shadow-xl p-6 card-hover">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-800">Survey History</h2>
                <p className="text-gray-500 text-sm">You have {surveyCount.toString()} survey{surveyCount !== 1n ? "s" : ""} stored</p>
              </div>
            </div>

            {surveyCount > 0n && (
              <div className="space-y-4">
                {Array.from({ length: Number(surveyCount) }).map((_, index) => {
                  const decrypted = decryptedSurveys[index];
                  return (
                    <div
                      key={index}
                      className="border-2 border-gray-100 rounded-xl p-4 hover:border-purple-200 hover:shadow-md transition-all"
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            #{index + 1}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-800">
                              Survey #{index + 1}
                            </h3>
                            {decrypted && (
                              <p className="text-xs text-gray-500 mt-1">
                                📅 {new Date(decrypted.timestamp * 1000).toLocaleString()}
                              </p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDecrypt(index)}
                          disabled={loading}
                          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white px-4 py-2 rounded-xl hover:from-green-600 hover:to-emerald-600 transition-all disabled:opacity-50 btn-glow"
                        >
                          {decrypted ? "🔄 Re-decrypt" : "🔓 Decrypt"}
                        </button>
                      </div>
                      {decrypted ? (
                        <div className="mt-3 bg-gradient-to-br from-blue-50 to-purple-50 p-4 rounded-xl">
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="flex items-center gap-2">
                              <span>😰</span>
                              <span className="text-gray-600">Stress:</span>
                              <span className="font-bold text-gray-800">{decrypted.stressLevel}/100</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>😟</span>
                              <span className="text-gray-600">Anxiety:</span>
                              <span className="font-bold text-gray-800">{decrypted.anxietyLevel}/100</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>😊</span>
                              <span className="text-gray-600">Mood:</span>
                              <span className="font-bold text-gray-800">{decrypted.moodScore}/100</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>😴</span>
                              <span className="text-gray-600">Sleep:</span>
                              <span className="font-bold text-gray-800">{decrypted.sleepQuality}/100</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span>⚡</span>
                              <span className="text-gray-600">Energy:</span>
                              <span className="font-bold text-gray-800">{decrypted.energyLevel}/100</span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-400 mt-2 flex items-center gap-2">
                          🔒 Encrypted data - Click "Decrypt" to view
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {surveyCount === 0n && (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-3 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-3xl">📋</span>
                </div>
                <p className="text-gray-500">No surveys submitted yet</p>
                <p className="text-gray-400 text-sm">Submit your first survey above!</p>
              </div>
            )}
          </div>

          {message && (
            <div className="mt-4 p-4 bg-white border-2 border-purple-200 rounded-xl shadow-lg">
              <p className="text-purple-800 flex items-center gap-2">
                {loading && <span className="animate-spin">⏳</span>}
                {message}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

