"use strict";

var ss = require("simple-statistics");

function forecast(x, ky, kx) {
  if (ky.length !== kx.length) {
    throw new Error("The length of ky and kx must be the same.");
  }

  let i = 0,
    nr = 0,
    dr = 0,
    ax = 0,
    ay = 0,
    a = 0,
    b = 0;

  ax = ss.mean(kx);
  ay = ss.mean(ky);

  for (i = 0; i < kx.length; i++) {
    nr += (kx[i] - ax) * (ky[i] - ay);
    dr += (kx[i] - ax) * (kx[i] - ax);
  }

  b = nr / dr;
  a = ay - b * ax;

  return a + b * x;
}

function calculate(values, answer) {
  const maxValue = ss.max(values);
  const minValue = ss.min(values);

  let result = 0;

  if (answer <= maxValue && answer >= minValue) {
    result += 0;
  } else {
    result += 0;
  }

  if (answer >= maxValue) {
    result += Math.abs(maxValue - answer);
  } else {
    result += 0;
  }

  if (answer <= minValue) {
    result += Math.abs(minValue - answer);
  } else {
    result += 0;
  }

  return result;
}

module.exports = () => ({
  async computeScore({
    programId,
    section,
    feature,
    fileIdentifier,
    answer,
    session,
  }) {
    const program = await strapi.entityService.findOne(
      "api::program.program",
      programId,
      {
        populate: {
          [section]: {
            populate: ["file"],
          },
        },
      }
    );

    if (!program) {
      return null;
    }

    const threshold = program.sessionsThreshold[session - 1];
    const values = program[section]
      .find((f) => f.identifier === fileIdentifier)
      [feature].map((f) => parseInt(f, 10));

    const max = ss.max(values);
    const min = ss.min(values);
    const topScore = 100;
    const minScore = 0;

    const convertedAnswer = calculate(values, answer);
    const diffMaxMin = Math.abs(topScore - max);
    const diffMinMin = Math.abs(minScore - min);

    let score = forecast(
      convertedAnswer,
      [1, 0],
      [0, ss.max([diffMaxMin, diffMinMin])]
    );
    score = score * 100;

    const result = score >= threshold ? true : false;
    return {
      score,
      result,
    };
  },
});
