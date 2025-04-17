"use strict";

const simpleStats = require("simple-statistics");
const answerHelpers = require("../helpers");

/**
 * answer service
 */
module.exports = () => ({
  /**
   * Computes score based on user answer and reference values
   * @param {Object} params - Computation parameters
   * @param {number} params.answer - User's answer value
   * @param {Array<number>} params.values - Reference values for scoring
   * @param {number} [params.threshold=100] - Threshold to determine pass/fail
   * @returns {Object} - Score results
   */
  computeScore({ answer, values, threshold = 100 }) {
    try {
      if (!Array.isArray(values) || values.length === 0) {
        throw new Error("Invalid reference values");
      }

      const max = simpleStats.max(values);
      const min = simpleStats.min(values);
      const topScore = 100;
      const minScore = 0;

      const convertedAnswer = answerHelpers.calculate(values, answer);
      const diffMaxMin = Math.abs(topScore - max);
      const diffMinMin = Math.abs(minScore - min);

      let score = answerHelpers.forecast(
        convertedAnswer,
        [1, 0],
        [0, simpleStats.max([diffMaxMin, diffMinMin])]
      );
      score = +(score * 100).toFixed(2);

      const result = score >= threshold;
      return {
        score,
        result,
      };
    } catch (error) {
      strapi.log.error(`Error computing score: ${error.message}`);
      return null;
    }
  },

  /**
   * Creates a reference map for assessment or training data
   * @param {Array} items - Reference items (assessment or training)
   * @param {Array<string>} features - Features to include in the map
   * @returns {Map} - Map of identifier to reference values
   */
  _createReferenceMap(items, features) {
    return new Map(
      items.map((item) => {
        const referenceObj = {};
        features.forEach((feature) => {
          referenceObj[feature] = Array.isArray(item[feature]) ? item[feature].map(Number) : [];
        });

        return [item.identifier, referenceObj];
      })
    );
  },

  /**
   * Processes audio results for a specific feature
   * @param {Array} audios - Audio submissions
   * @param {Map} referenceMap - Map of references
   * @param {string} feature - Feature to process
   * @returns {Array} - Processed results
   */
  _processAudioFeatureResults(audios, referenceMap, feature) {
    return audios.map((audio) => {
      const { duration, identifier, numberOfAudioClicks } = audio;
      const reference = referenceMap.get(identifier);

      if (!reference) {
        strapi.log.warn(`No reference found for identifier: ${identifier}`);
        return {
          identifier,
          duration,
          numberOfAudioClicks,
          score: 0,
          answer: audio[feature] || audio.value,
          numberOfAttempts: audio.numberOfAttempts || 1,
        };
      }

      return {
        identifier,
        duration,
        numberOfAudioClicks,
        score: this.computeScore({
          answer: audio[feature] ?? audio.value,
          values: reference[feature],
        }).score,
        answer: audio[feature] ?? audio.value,
        numberOfAttempts: audio.numberOfAttempts || 1,
      };
    });
  },

  /**
   * Processes assessment results from multiple audio submissions
   * @param {Object} params - Assessment parameters
   * @param {Array} params.audios - Audio submissions
   * @param {Array} params.assessment - Assessment reference data
   * @returns {Object} - Compiled results for roughness and breathiness
   */
  computeAssessmentResults({ audios, assessment }) {
    if (!audios || !assessment) {
      strapi.log.error("Missing audios or assessment data");
      return { roughnessResults: [], breathinessResults: [] };
    }

    try {
      const assessmentMap = this._createReferenceMap(assessment, ["roughness", "breathiness"]);
      return {
        roughnessResults: this._processAudioFeatureResults(audios, assessmentMap, "roughness"),
        breathinessResults: this._processAudioFeatureResults(audios, assessmentMap, "breathiness"),
      };
    } catch (error) {
      strapi.log.error(`Error computing assessment results: ${error.message}`);
      return { roughnessResults: [], breathinessResults: [] };
    }
  },

  /**
   * Processes training results for a specific feature
   * @param {Object} params - Training parameters
   * @param {Array} params.audios - Audio submissions
   * @param {Array} params.training - Training reference data
   * @param {string} params.feature - Feature to process (roughness/breathiness)
   * @returns {Array} - Processed results
   */
  computeTrainingResults({ audios, training, feature }) {
    if (!audios || !training || !feature) {
      strapi.log.error("Missing audios, training or feature data");
      return [];
    }

    try {
      const trainingMap = this._createReferenceMap(training, [feature]);
      return this._processAudioFeatureResults(audios, trainingMap, feature);
    } catch (error) {
      strapi.log.error(`Error computing training results: ${error.message}`);
      return [];
    }
  },
});
