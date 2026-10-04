const assert = require("assert");
const { validateBirthInput } = require("../birth_input");

function test() {
  const zero = validateBirthInput({
    year: 2000,
    month: 1,
    day: 1,
    hour: 0,
    minute: 0,
    latitude: 0,
    longitude: 0,
    timezone: 0,
  });
  assert.equal(zero.ok, true);
  assert.equal(zero.latitude, 0);
  assert.equal(zero.longitude, 0);
  assert.equal(zero.hour, 0);
  assert.equal(zero.minute, 0);
  assert.equal(zero.timezone, 0);

  const missing = validateBirthInput({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    latitude: undefined,
    longitude: 10,
  });
  assert.equal(missing.ok, false);
  assert.ok(missing.errors.indexOf("latitude") !== -1);

  const range = validateBirthInput({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    latitude: 91,
    longitude: 0,
  });
  assert.equal(range.ok, false);

  const blank = validateBirthInput({
    year: 2000,
    month: 1,
    day: 1,
    hour: 12,
    minute: 0,
    latitude: "",
    longitude: 0,
  });
  assert.equal(blank.ok, false);
}

module.exports = test;
