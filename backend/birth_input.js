/**
 * Birth-data checks. Zero is a valid latitude, longitude, hour, minute,
 * and timezone offset. Missing and non-numeric values are not.
 */

function toNumber(value) {
  if (typeof value === "number") return value;
  if (typeof value === "string" && value.trim() !== "") return Number(value);
  return NaN;
}

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function numberInRange(value, min, max) {
  if (isMissing(value)) return false;
  const n = toNumber(value);
  if (Number.isNaN(n)) return false;
  return n >= min && n <= max;
}

function validateBirthInput(input) {
  const source = input || {};
  const timeUnknown = !!source.unknownBirthTime;
  const errors = [];
  if (!numberInRange(source.year, 1, 9999)) errors.push("year");
  if (!numberInRange(source.month, 1, 12)) errors.push("month");
  if (!numberInRange(source.day, 1, 31)) errors.push("day");
  if (!timeUnknown && !numberInRange(source.hour, 0, 23)) errors.push("hour");
  if (!timeUnknown && !numberInRange(source.minute, 0, 59)) errors.push("minute");
  if (!numberInRange(source.latitude, -90, 90)) errors.push("latitude");
  if (!numberInRange(source.longitude, -180, 180)) errors.push("longitude");
  if (!isMissing(source.timezone) && !numberInRange(source.timezone, -12, 14)) {
    errors.push("timezone");
  }
  return {
    ok: errors.length === 0,
    errors: errors,
    latitude: toNumber(source.latitude),
    longitude: toNumber(source.longitude),
    timezone: isMissing(source.timezone) ? 0 : toNumber(source.timezone),
    hour: timeUnknown ? 12 : toNumber(source.hour),
    minute: timeUnknown ? 0 : toNumber(source.minute),
  };
}

module.exports = {
  validateBirthInput,
  numberInRange,
};
