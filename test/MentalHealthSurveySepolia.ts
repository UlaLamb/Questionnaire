import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { MentalHealthSurvey } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("MentalHealthSurveySepolia", function () {
  let signers: Signers;
  let mentalHealthSurveyContract: MentalHealthSurvey;
  let mentalHealthSurveyContractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const MentalHealthSurveyDeployment = await deployments.get("MentalHealthSurvey");
      mentalHealthSurveyContractAddress = MentalHealthSurveyDeployment.address;
      mentalHealthSurveyContract = await ethers.getContractAt(
        "MentalHealthSurvey",
        MentalHealthSurveyDeployment.address
      );
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("should submit and retrieve a survey on Sepolia", async function () {
    steps = 15;

    this.timeout(4 * 40000);

    const stressLevel = 75;
    const anxietyLevel = 60;
    const moodScore = 50;
    const sleepQuality = 70;
    const energyLevel = 65;

    progress("Encrypting survey values...");
    const encryptedInput = await fhevm
      .createEncryptedInput(mentalHealthSurveyContractAddress, signers.alice.address)
      .add32(stressLevel)
      .add32(anxietyLevel)
      .add32(moodScore)
      .add32(sleepQuality)
      .add32(energyLevel)
      .encrypt();

    progress(
      `Call submitSurvey() MentalHealthSurvey=${mentalHealthSurveyContractAddress} signer=${signers.alice.address}...`
    );
    let tx = await mentalHealthSurveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedInput.handles[0],
        encryptedInput.handles[1],
        encryptedInput.handles[2],
        encryptedInput.handles[3],
        encryptedInput.handles[4],
        encryptedInput.inputProof
      );
    await tx.wait();

    progress(`Call getSurveyCount()...`);
    const count = await mentalHealthSurveyContract.getSurveyCount(signers.alice.address);
    expect(count).to.be.gt(0);

    progress(`Call getStressLevel()...`);
    const encryptedStressLevel = await mentalHealthSurveyContract.getStressLevel(signers.alice.address, 0);
    expect(encryptedStressLevel).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting stress level...`);
    const clearStressLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStressLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    progress(`Clear stress level=${clearStressLevel}`);
    expect(clearStressLevel).to.eq(stressLevel);

    progress(`Call getAnxietyLevel()...`);
    const encryptedAnxietyLevel = await mentalHealthSurveyContract.getAnxietyLevel(signers.alice.address, 0);

    progress(`Decrypting anxiety level...`);
    const clearAnxietyLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedAnxietyLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    progress(`Clear anxiety level=${clearAnxietyLevel}`);
    expect(clearAnxietyLevel).to.eq(anxietyLevel);

    progress(`Call getMoodScore()...`);
    const encryptedMoodScore = await mentalHealthSurveyContract.getMoodScore(signers.alice.address, 0);

    progress(`Decrypting mood score...`);
    const clearMoodScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedMoodScore,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    progress(`Clear mood score=${clearMoodScore}`);
    expect(clearMoodScore).to.eq(moodScore);

    progress(`Call getSleepQuality()...`);
    const encryptedSleepQuality = await mentalHealthSurveyContract.getSleepQuality(signers.alice.address, 0);

    progress(`Decrypting sleep quality...`);
    const clearSleepQuality = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedSleepQuality,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    progress(`Clear sleep quality=${clearSleepQuality}`);
    expect(clearSleepQuality).to.eq(sleepQuality);

    progress(`Call getEnergyLevel()...`);
    const encryptedEnergyLevel = await mentalHealthSurveyContract.getEnergyLevel(signers.alice.address, 0);

    progress(`Decrypting energy level...`);
    const clearEnergyLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedEnergyLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    progress(`Clear energy level=${clearEnergyLevel}`);
    expect(clearEnergyLevel).to.eq(energyLevel);
  });
});

