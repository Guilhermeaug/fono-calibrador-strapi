"use strict";

const simpleStats = require("simple-statistics");
const answerHelpers = require("../helpers");

module.exports = () => ({
  computeScore({ answer, values, threshold = 100 }) {
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

    const result = score >= threshold ? true : false;
    return {
      score,
      result,
    };
  },
  computeAssessmentResults({ audios, assessment }) {
    const assessmentMap = new Map(
      assessment.map((item) => [
        item.identifier,
        {
          roughness: item.roughness.map(Number),
          breathiness: item.breathiness.map(Number),
        },
      ])
    );

    return {
      roughnessResults: audios.map((audio) => {
        const { duration, identifier, numberOfAudioClicks, roughness } = audio;
        const reference = assessmentMap.get(identifier);

        return {
          identifier,
          duration,
          numberOfAudioClicks,
          score: this.computeScore({
            answer: roughness,
            values: reference.roughness,
          }).score,
          answer: roughness,
        };
      }),
      breathinessResults: audios.map((audio) => {
        const { duration, identifier, numberOfAudioClicks, breathiness } = audio;
        const reference = assessmentMap.get(identifier);

        return {
          identifier,
          duration,
          numberOfAudioClicks,
          score: this.computeScore({
            answer: breathiness,
            values: reference.breathiness,
          }).score,
          answer: breathiness,
        };
      }),
    };
  },
  computeTrainingResults({ audios, training, feature }) {
    const trainingMap = new Map(
      training.map((item) => [
        item.identifier,
        {
          value: item[feature].map(Number),
        },
      ])
    );

    return audios.map((audio) => {
      const { duration, identifier, numberOfAttempts, numberOfAudioClicks, value } = audio;
      const reference = trainingMap.get(identifier);

      return {
        identifier,
        duration,
        numberOfAttempts,
        numberOfAudioClicks,
        score: this.computeScore({
          answer: value,
          values: reference.value,
        }).score,
        answer: value,
      };
    });
  },
});
