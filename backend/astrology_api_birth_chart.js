// Preserved AstrologyAPI.com natal-chart path (backup).
// Used automatically if Swiss Ephemeris fails, or if CHART_ENGINE=astrologyapi.

const axios = require("axios");
const {
  getSignFromDegree,
  getElementFromSign,
  calculateAspects,
  decorateAspects,
  normalizeAsteroidList,
} = require("./chart_format");

function generateAuth() {
  const userId = process.env.ASTROLOGY_API_USER_ID;
  const apiKey = process.env.ASTROLOGY_API_KEY;
  const credentials = Buffer.from(`${userId}:${apiKey}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

async function calculateBirthChartAstrologyApi({
  year,
  month,
  day,
  hour,
  minute,
  latitude,
  longitude,
  timezone,
  asteroids,
}) {
  const auth = generateAuth();
  const body = {
    day: parseInt(day, 10),
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    hour: parseInt(hour, 10),
    min: parseInt(minute, 10),
    lat: parseFloat(latitude),
    lon: parseFloat(longitude),
    tzone: parseFloat(timezone || 0),
  };

  console.log("Making API request to AstrologyAPI.com...");
  const planetsResponse = await axios.post(
    "https://json.astrologyapi.com/v1/planets/tropical",
    body,
    { headers: auth },
  );
  const housesResponse = await axios.post(
    "https://json.astrologyapi.com/v1/house_cusps/tropical",
    { ...body, house_system: "placidus" },
    { headers: auth },
  );

  if (
    planetsResponse.data.status === false ||
    !Array.isArray(planetsResponse.data)
  ) {
    throw new Error(
      `AstrologyAPI.com error: ${
        planetsResponse.data.msg ||
        "Invalid API credentials. Please set ASTROLOGY_API_USER_ID and ASTROLOGY_API_KEY in your .env file."
      }`,
    );
  }
  if (housesResponse.data.status === false) {
    throw new Error(
      `AstrologyAPI.com error: ${
        housesResponse.data.msg || "Invalid API credentials"
      }`,
    );
  }

  const planetsResponseData = planetsResponse.data;
  const housesResponseData = housesResponse.data;
  const selectedAsteroids = normalizeAsteroidList(asteroids);
  const asteroidNameMap = {
    chiron: ["Chiron"],
    ceres: ["Ceres"],
    pallas: ["Pallas", "Pallas Athena"],
    juno: ["Juno"],
    vesta: ["Vesta"],
  };
  const asteroidBodies = {};
  selectedAsteroids.forEach((key) => {
    const names = asteroidNameMap[key] || [];
    const hit = planetsResponseData.find((p) => names.includes(p.name));
    if (!hit) return;
    asteroidBodies[key] = {
      degree: hit.fullDegree || 0,
      sign: hit.sign || "Unknown",
      element: getElementFromSign(hit.sign),
      house: hit.house || 0,
      isRetrograde: hit.isRetro === "true",
      speed: hit.speed || 0,
    };
  });
  const aspectDegrees = {
    sun: planetsResponseData.find((p) => p.name === "Sun")?.fullDegree || 0,
    moon: planetsResponseData.find((p) => p.name === "Moon")?.fullDegree || 0,
    mercury:
      planetsResponseData.find((p) => p.name === "Mercury")?.fullDegree || 0,
    venus:
      planetsResponseData.find((p) => p.name === "Venus")?.fullDegree || 0,
    mars: planetsResponseData.find((p) => p.name === "Mars")?.fullDegree || 0,
    jupiter:
      planetsResponseData.find((p) => p.name === "Jupiter")?.fullDegree || 0,
    saturn:
      planetsResponseData.find((p) => p.name === "Saturn")?.fullDegree || 0,
    uranus:
      planetsResponseData.find((p) => p.name === "Uranus")?.fullDegree || 0,
    neptune:
      planetsResponseData.find((p) => p.name === "Neptune")?.fullDegree || 0,
    pluto:
      planetsResponseData.find((p) => p.name === "Pluto")?.fullDegree || 0,
  };
  const aspectLookup = {};
  [
    "sun",
    "moon",
    "mercury",
    "venus",
    "mars",
    "jupiter",
    "saturn",
    "uranus",
    "neptune",
    "pluto",
  ].forEach((key) => {
    const planetData = planetsResponseData.find(
      (p) => p.name === key.charAt(0).toUpperCase() + key.slice(1),
    );
    aspectLookup[key] = {
      sign: planetData?.sign,
      degree: planetData?.fullDegree || 0,
    };
  });
  Object.entries(asteroidBodies).forEach(([key, body]) => {
    aspectDegrees[key] = body.degree;
    aspectLookup[key] = body;
  });

  return {
    birthData: {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
      location: { latitude, longitude, timezone },
    },
    angles: {
      ascendant: {
        degree: housesResponseData.ascendant || 0,
        sign:
          planetsResponseData.find((p) => p.name === "Ascendant")?.sign ||
          "Unknown",
        element: getElementFromSign(
          planetsResponseData.find((p) => p.name === "Ascendant")?.sign,
        ),
      },
      midheaven: {
        degree: housesResponseData.midheaven || 0,
        sign: getSignFromDegree(housesResponseData.midheaven),
        element: getElementFromSign(
          getSignFromDegree(housesResponseData.midheaven),
        ),
      },
    },
    planets: Object.fromEntries(
      [
        "Sun",
        "Moon",
        "Mercury",
        "Venus",
        "Mars",
        "Jupiter",
        "Saturn",
        "Uranus",
        "Neptune",
        "Pluto",
      ].map((planet) => {
        const planetData = planetsResponseData.find((p) => p.name === planet);
        return [
          planet.toLowerCase(),
          {
            degree: planetData?.fullDegree || 0,
            sign: planetData?.sign || "Unknown",
            element: getElementFromSign(planetData?.sign),
            house: planetData?.house || 0,
            isRetrograde: planetData?.isRetro === "true",
            speed: planetData?.speed || 0,
          },
        ];
      }),
    ),
    houses: (housesResponseData.houses || []).map((house, index) => ({
      number: index + 1,
      degree: house.degree,
      sign: house.sign,
      element: getElementFromSign(house.sign),
    })),
    points: (function optionalPoints() {
      const nodeNames = ["True Node", "North Node", "Mean Node", "Rahu"];
      const node = planetsResponseData.find((p) => nodeNames.includes(p.name));
      if (!node) return null;
      return {
        northNode: {
          degree: node.fullDegree || 0,
          sign: node.sign || "Unknown",
          house: node.house || 0,
          isRetrograde: node.isRetro === "true",
        },
      };
    })(),
    aspects: decorateAspects(
      calculateAspects(aspectDegrees, {
        tightOrbKeys: selectedAsteroids,
        tightOrb: 3,
      }),
      aspectLookup,
    ),
    asteroids: asteroidBodies,
    selectedAsteroids,
  };
}

module.exports = {
  generateAuth,
  calculateBirthChartAstrologyApi,
};
