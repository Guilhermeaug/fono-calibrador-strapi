const simpleStats = require("simple-statistics");

module.exports = {
  forecast(targetX, knownX, knownY) {
    const meanX = simpleStats.mean(knownX);
    const meanY = simpleStats.mean(knownY);

    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < knownX.length; i++) {
      const deviationX = knownX[i] - meanX;
      const deviationY = knownY[i] - meanY;
      numerator += deviationX * deviationY;
      denominator += deviationX * deviationX;
    }

    const slope = numerator / denominator;
    const intercept = meanY - slope * meanX;

    return intercept + slope * targetX;
  },
  calculate(dataPoints, targetValue) {
    const maxValue = simpleStats.max(dataPoints);
    const minValue = simpleStats.min(dataPoints);

    let deviation = 0;

    if (targetValue > maxValue) {
      deviation += Math.abs(maxValue - targetValue);
    }

    if (targetValue < minValue) {
      deviation += Math.abs(minValue - targetValue);
    }

    return deviation;
  },
};
