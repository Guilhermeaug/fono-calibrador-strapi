const simpleStats = require("simple-statistics");

module.exports = {
  forecast(x, ky, kx) {
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

    ax = simpleStats.mean(kx);
    ay = simpleStats.mean(ky);

    for (i = 0; i < kx.length; i++) {
      nr += (kx[i] - ax) * (ky[i] - ay);
      dr += (kx[i] - ax) * (kx[i] - ax);
    }

    b = nr / dr;
    a = ay - b * ax;

    return a + b * x;
  },
  calculate(values, answer) {
    const maxValue = simpleStats.max(values);
    const minValue = simpleStats.min(values);

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
  },
};
