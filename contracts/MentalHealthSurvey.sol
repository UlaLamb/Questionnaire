// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title MentalHealthSurvey
/// @notice Store and retrieve user's encrypted mental health survey responses
/// @dev Uses Zama FHEVM types. All numerical fields are encrypted euint32.
contract MentalHealthSurvey is SepoliaConfig {
    struct SurveyResponse {
        euint32 stressLevel;      // Stress index (0-100)
        euint32 anxietyLevel;      // Anxiety level (0-100)
        euint32 moodScore;        // Mood score (0-100)
        euint32 sleepQuality;      // Sleep quality (0-100)
        euint32 energyLevel;      // Energy level (0-100)
        uint256 timestamp;        // Clear text timestamp
    }

    mapping(address => SurveyResponse[]) private _userSurveys;

    /// @notice Submit a new mental health survey response
    /// @param stressLevel external encrypted stress level handle
    /// @param anxietyLevel external encrypted anxiety level handle
    /// @param moodScore external encrypted mood score handle
    /// @param sleepQuality external encrypted sleep quality handle
    /// @param energyLevel external encrypted energy level handle
    /// @param inputProof input proof returned by the relayer SDK encrypt()
    function submitSurvey(
        externalEuint32 stressLevel,
        externalEuint32 anxietyLevel,
        externalEuint32 moodScore,
        externalEuint32 sleepQuality,
        externalEuint32 energyLevel,
        bytes calldata inputProof
    ) external {
        euint32 _stressLevel = FHE.fromExternal(stressLevel, inputProof);
        euint32 _anxietyLevel = FHE.fromExternal(anxietyLevel, inputProof);
        euint32 _moodScore = FHE.fromExternal(moodScore, inputProof);
        euint32 _sleepQuality = FHE.fromExternal(sleepQuality, inputProof);
        euint32 _energyLevel = FHE.fromExternal(energyLevel, inputProof);

        SurveyResponse memory newResponse = SurveyResponse({
            stressLevel: _stressLevel,
            anxietyLevel: _anxietyLevel,
            moodScore: _moodScore,
            sleepQuality: _sleepQuality,
            energyLevel: _energyLevel,
            timestamp: block.timestamp
        });

        _userSurveys[msg.sender].push(newResponse);

        // Allow access: contract and user
        FHE.allowThis(_stressLevel);
        FHE.allowThis(_anxietyLevel);
        FHE.allowThis(_moodScore);
        FHE.allowThis(_sleepQuality);
        FHE.allowThis(_energyLevel);

        FHE.allow(_stressLevel, msg.sender);
        FHE.allow(_anxietyLevel, msg.sender);
        FHE.allow(_moodScore, msg.sender);
        FHE.allow(_sleepQuality, msg.sender);
        FHE.allow(_energyLevel, msg.sender);
    }

    /// @notice Get the number of surveys submitted by a user
    /// @param account The user's address
    /// @return The number of surveys
    function getSurveyCount(address account) external view returns (uint256) {
        return _userSurveys[account].length;
    }

    /// @notice Get the timestamp of a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The timestamp of the survey
    function getSurveyTimestamp(address account, uint256 index) external view returns (uint256) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].timestamp;
    }

    /// @notice Get encrypted stress level for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The encrypted stress level
    function getStressLevel(address account, uint256 index) external view returns (euint32) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].stressLevel;
    }

    /// @notice Get encrypted anxiety level for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The encrypted anxiety level
    function getAnxietyLevel(address account, uint256 index) external view returns (euint32) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].anxietyLevel;
    }

    /// @notice Get encrypted mood score for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The encrypted mood score
    function getMoodScore(address account, uint256 index) external view returns (euint32) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].moodScore;
    }

    /// @notice Get encrypted sleep quality for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The encrypted sleep quality
    function getSleepQuality(address account, uint256 index) external view returns (euint32) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].sleepQuality;
    }

    /// @notice Get encrypted energy level for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return The encrypted energy level
    function getEnergyLevel(address account, uint256 index) external view returns (euint32) {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        return _userSurveys[account][index].energyLevel;
    }

    /// @notice Get all encrypted data for a specific survey
    /// @param account The user's address
    /// @param index The survey index
    /// @return stressLevel The encrypted stress level
    /// @return anxietyLevel The encrypted anxiety level
    /// @return moodScore The encrypted mood score
    /// @return sleepQuality The encrypted sleep quality
    /// @return energyLevel The encrypted energy level
    /// @return timestamp The timestamp of the survey
    function getSurvey(
        address account,
        uint256 index
    )
        external
        view
        returns (
            euint32 stressLevel,
            euint32 anxietyLevel,
            euint32 moodScore,
            euint32 sleepQuality,
            euint32 energyLevel,
            uint256 timestamp
        )
    {
        require(index < _userSurveys[account].length, "Survey index out of bounds");
        SurveyResponse storage survey = _userSurveys[account][index];
        return (
            survey.stressLevel,
            survey.anxietyLevel,
            survey.moodScore,
            survey.sleepQuality,
            survey.energyLevel,
            survey.timestamp
        );
    }
}

