function body(sign, degree, house, extra) {
  return Object.assign(
    {
      sign: sign,
      degree: degree,
      house: house,
      isRetrograde: false,
      speed: 1,
    },
    extra || {},
  );
}

function aspect(planet1, planet2, name, orb) {
  return {
    planet1: planet1,
    planet2: planet2,
    aspect: name,
    orb: orb,
  };
}

/**
 * Timed modern chart: Capricorn rising, Saturn domicile and angular,
 * Sun-Moon opposition squared by Mars.
 */
function timedChart() {
  return {
    chartSystem: "modern",
    unknownBirthTime: false,
    angles: {
      ascendant: { sign: "Capricorn", degree: 10 },
      midheaven: { sign: "Libra", degree: 5 },
    },
    houses: [10, 40, 70, 100, 130, 160, 190, 220, 250, 280, 310, 340],
    planets: {
      sun: body("Capricorn", 285, 1, { speed: 1.0 }),
      moon: body("Cancer", 105.4, 7, { speed: 13 }),
      mercury: body("Capricorn", 292, 1, { isRetrograde: true, speed: -0.8 }),
      venus: body("Libra", 188, 10, { speed: 1.2 }),
      mars: body("Aries", 15.2, 4, { speed: 0.6 }),
      jupiter: body("Sagittarius", 252, 12, { speed: 0.2 }),
      saturn: body("Capricorn", 275, 1, { speed: 0.1 }),
      uranus: body("Aquarius", 303, 2, { speed: 0.05 }),
      neptune: body("Pisces", 348, 3, { speed: 0.03 }),
      pluto: body("Scorpio", 219, 11, { speed: 0.02 }),
    },
    aspects: [
      aspect("sun", "moon", "opposition", 0.4),
      aspect("sun", "mars", "square", 1.2),
      aspect("moon", "mars", "square", 0.8),
      aspect("saturn", "sun", "conjunction", 4),
    ],
  };
}

function unknownTimeChart() {
  const chart = timedChart();
  chart.unknownBirthTime = true;
  return chart;
}

function traditionalChart() {
  const chart = timedChart();
  chart.chartSystem = "traditional";
  return chart;
}

module.exports = {
  timedChart,
  unknownTimeChart,
  traditionalChart,
};
