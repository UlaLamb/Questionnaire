import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { MentalHealthSurvey, MentalHealthSurvey__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("MentalHealthSurvey")) as MentalHealthSurvey__factory;
  const mentalHealthSurveyContract = (await factory.deploy()) as MentalHealthSurvey;
  const mentalHealthSurveyContractAddress = await mentalHealthSurveyContract.getAddress();

  return { mentalHealthSurveyContract, mentalHealthSurveyContractAddress };
}

describe("MentalHealthSurvey", function () {
  let signers: Signers;
  let mentalHealthSurveyContract: MentalHealthSurvey;
  let mentalHealthSurveyContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ mentalHealthSurveyContract, mentalHealthSurveyContractAddress } = await deployFixture());
  });

  it("should return zero surveys for new user", async function () {
    const count = await mentalHealthSurveyContract.getSurveyCount(signers.alice.address);
    expect(count).to.eq(0);
  });

  it("should submit a survey successfully", async function () {
    const stressLevel = 75;
    const anxietyLevel = 60;
    const moodScore = 50;
    const sleepQuality = 70;
    const energyLevel = 65;

    // Encrypt all values
    const encryptedInput = await fhevm
      .createEncryptedInput(mentalHealthSurveyContractAddress, signers.alice.address)
      .add32(stressLevel)
      .add32(anxietyLevel)
      .add32(moodScore)
      .add32(sleepQuality)
      .add32(energyLevel)
      .encrypt();

    const tx = await mentalHealthSurveyContract
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

    const count = await mentalHealthSurveyContract.getSurveyCount(signers.alice.address);
    expect(count).to.eq(1);
  });

  it("should retrieve and decrypt survey data", async function () {
    const stressLevel = 80;
    const anxietyLevel = 70;
    const moodScore = 40;
    const sleepQuality = 60;
    const energyLevel = 55;

    // Encrypt all values
    const encryptedInput = await fhevm
      .createEncryptedInput(mentalHealthSurveyContractAddress, signers.alice.address)
      .add32(stressLevel)
      .add32(anxietyLevel)
      .add32(moodScore)
      .add32(sleepQuality)
      .add32(energyLevel)
      .encrypt();

    const tx = await mentalHealthSurveyContract
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

    // Retrieve encrypted handles
    const encryptedStressLevel = await mentalHealthSurveyContract.getStressLevel(signers.alice.address, 0);
    const encryptedAnxietyLevel = await mentalHealthSurveyContract.getAnxietyLevel(signers.alice.address, 0);
    const encryptedMoodScore = await mentalHealthSurveyContract.getMoodScore(signers.alice.address, 0);
    const encryptedSleepQuality = await mentalHealthSurveyContract.getSleepQuality(signers.alice.address, 0);
    const encryptedEnergyLevel = await mentalHealthSurveyContract.getEnergyLevel(signers.alice.address, 0);

    // Decrypt values
    const clearStressLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedStressLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    const clearAnxietyLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedAnxietyLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    const clearMoodScore = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedMoodScore,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    const clearSleepQuality = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedSleepQuality,
      mentalHealthSurveyContractAddress,
      signers.alice
    );
    const clearEnergyLevel = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedEnergyLevel,
      mentalHealthSurveyContractAddress,
      signers.alice
    );

    expect(clearStressLevel).to.eq(stressLevel);
    expect(clearAnxietyLevel).to.eq(anxietyLevel);
    expect(clearMoodScore).to.eq(moodScore);
    expect(clearSleepQuality).to.eq(sleepQuality);
    expect(clearEnergyLevel).to.eq(energyLevel);
  });

  it("should allow multiple surveys per user", async function () {
    // Submit first survey
    const encryptedInput1 = await fhevm
      .createEncryptedInput(mentalHealthSurveyContractAddress, signers.alice.address)
      .add32(70)
      .add32(60)
      .add32(50)
      .add32(70)
      .add32(60)
      .encrypt();

    await mentalHealthSurveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedInput1.handles[0],
        encryptedInput1.handles[1],
        encryptedInput1.handles[2],
        encryptedInput1.handles[3],
        encryptedInput1.handles[4],
        encryptedInput1.inputProof
      )
      .then((tx) => tx.wait());

    // Submit second survey
    const encryptedInput2 = await fhevm
      .createEncryptedInput(mentalHealthSurveyContractAddress, signers.alice.address)
      .add32(50)
      .add32(40)
      .add32(70)
      .add32(80)
      .add32(75)
      .encrypt();

    await mentalHealthSurveyContract
      .connect(signers.alice)
      .submitSurvey(
        encryptedInput2.handles[0],
        encryptedInput2.handles[1],
        encryptedInput2.handles[2],
        encryptedInput2.handles[3],
        encryptedInput2.handles[4],
        encryptedInput2.inputProof
      )
      .then((tx) => tx.wait());

    const count = await mentalHealthSurveyContract.getSurveyCount(signers.alice.address);
    expect(count).to.eq(2);
  });
});

