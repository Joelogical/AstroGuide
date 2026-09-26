// Local natal / transit positions via Swiss Ephemeris (@swisseph/node).
// Output matches the existing AstrologyAPI-transformed birthChart shape.

const {
  ASTEROID_KEYS,
  normalizeAsteroidList,
  getSignFromDegree,
  getElementFromSign,
  houseForLongitude,
  calculateAspects,
  decorateAspects,
} = require("./chart_format");

function loadSwiss() {
  return require("@swisseph/node");
}

function localToJulianDay(year, month, day, hour, minute, timezoneHours, julianDayFn) {
  const tz = Number(timezoneHours) || 0;
  let y = parseInt(year, 10);
  let m = parseInt(month, 10);
  let d = parseInt(day, 10);
  let decimalUtc =
    parseInt(hour, 10) + parseInt(minute, 10) / 60 - tz;

  if (decimalUtc < 0 || decimalUtc >= 24) {
    const shiftDays = Math.floor(decimalUtc / 24);
    decimalUtc -= shiftDays * 24;
    const utc = new Date(Date.UTC(y, m - 1, d));
    utc.setUTCDate(utc.getUTCDate() + shiftDays);
    y = utc.getUTCFullYear();
    m = utc.getUTCMonth() + 1;
    d = utc.getUTCDate();
  }
  return julianDayFn(y, m, d, decimalUtc);
}

function pointFromLongitude(longitude, speed, cusps) {
  const sign = getSignFromDegree(longitude);
  return {
    degree: longitude,
    sign,
    element: getElementFromSign(sign),
    house: houseForLongitude(longitude, cusps),
    isRetrograde: Number(speed) < 0,
    speed: Number(speed) || 0,
  };
}

function calculateBirthChartSwiss({
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
  const {
    julianDay,
    calculatePosition,
    calculateHouses,
    Planet,
    HouseSystem,
    LunarPoint,
    Asteroid,
  } = loadSwiss();
  const lat = parseFloat(latitude);
  const lon = parseFloat(longitude);
  const jd = localToJulianDay(year, month, day, hour, minute, timezone, julianDay);
  const housesRaw = calculateHouses(jd, lat, lon, HouseSystem.Placidus);
  const cusps = [];
  for (let i = 1; i <= 12; i++) {
    cusps.push(housesRaw.cusps[i]);
  }

  const planetIds = [
    ["sun", Planet.Sun],
    ["moon", Planet.Moon],
    ["mercury", Planet.Mercury],
    ["venus", Planet.Venus],
    ["mars", Planet.Mars],
    ["jupiter", Planet.Jupiter],
    ["saturn", Planet.Saturn],
    ["uranus", Planet.Uranus],
    ["neptune", Planet.Neptune],
    ["pluto", Planet.Pluto],
  ];

  const planets = {};
  const aspectDegrees = {};
  for (const [name, id] of planetIds) {
    const pos = calculatePosition(jd, id);
    const point = pointFromLongitude(pos.longitude, pos.longitudeSpeed, cusps);
    planets[name] = point;
    aspectDegrees[name] = point.degree;
  }

  const asteroidIds = {
    chiron: Asteroid.Chiron,
    ceres: Asteroid.Ceres,
    pallas: Asteroid.Pallas,
    juno: Asteroid.Juno,
    vesta: Asteroid.Vesta,
  };
  const selectedAsteroids = normalizeAsteroidList(asteroids);
  const asteroidBodies = {};
  const aspectLookup = { ...planets };
  for (const key of selectedAsteroids) {
    const id = asteroidIds[key];
    if (id == null) continue;
    try {
      const pos = calculatePosition(jd, id);
      const point = pointFromLongitude(
        pos.longitude,
        pos.longitudeSpeed,
        cusps,
      );
      asteroidBodies[key] = point;
      aspectDegrees[key] = point.degree;
      aspectLookup[key] = point;
    } catch (astErr) {
      console.warn("[SWISSEPH] Asteroid failed:", key, astErr.message);
    }
  }

  let northNode = null;
  try {
    const node = calculatePosition(jd, LunarPoint.TrueNode);
    northNode = pointFromLongitude(node.longitude, node.longitudeSpeed, cusps);
  } catch (nodeErr) {
    console.warn("[SWISSEPH] True Node failed:", nodeErr.message);
  }

  const ascSign = getSignFromDegree(housesRaw.ascendant);
  const mcSign = getSignFromDegree(housesRaw.mc);

  return {
    birthData: {
      date: `${year}-${month}-${day}`,
      time: `${hour}:${minute}`,
      location: { latitude, longitude, timezone },
    },
    angles: {
      ascendant: {
        degree: housesRaw.ascendant,
        sign: ascSign,
        element: getElementFromSign(ascSign),
      },
      midheaven: {
        degree: housesRaw.mc,
        sign: mcSign,
        element: getElementFromSign(mcSign),
      },
    },
    planets,
    houses: cusps.map((degree, index) => {
      const sign = getSignFromDegree(degree);
      return {
        number: index + 1,
        degree,
        sign,
        element: getElementFromSign(sign),
      };
    }),
    points: northNode ? { northNode } : null,
    asteroids: asteroidBodies,
    selectedAsteroids,
    aspects: decorateAspects(
      calculateAspects(aspectDegrees, {
        tightOrbKeys: selectedAsteroids,
        tightOrb: 3,
      }),
      aspectLookup,
    ),
  };
}

function calculateTransitPositionsSwiss({
  year,
  month,
  day,
  hour,
  minute,
  latitude,
  longitude,
  timezone,
}) {
  const chart = calculateBirthChartSwiss({
    year,
    month,
    day,
    hour,
    minute,
    latitude,
    longitude,
    timezone,
  });
  const planets = {};
  Object.entries(chart.planets).forEach(([key, p]) => {
    planets[key.charAt(0).toUpperCase() + key.slice(1)] = {
      sign: p.sign,
      degree: p.degree,
      house: p.house,
      isRetrograde: p.isRetrograde,
    };
  });
  return {
    date: `${year}-${month}-${day}`,
    time: `${hour}:${minute}`,
    location: "Greenwich, UK (default)",
    planets,
  };
}

module.exports = {
  ASTEROID_KEYS,
  normalizeAsteroidList,
  calculateBirthChartSwiss,
  calculateTransitPositionsSwiss,
  localToJulianDay,
};
