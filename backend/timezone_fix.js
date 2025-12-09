// Timezone calculation utility
// This module provides proper timezone handling for birth chart calculations

/**
 * Get timezone offset for a specific date and location
 * Uses a timezone API or approximation based on coordinates and date
 *
 * @param {number} latitude - Latitude in degrees
 * @param {number} longitude - Longitude in degrees
 * @param {number} year - Birth year
 * @param {number} month - Birth month (1-12)
 * @param {number} day - Birth day
 * @returns {Promise<number>} Timezone offset in hours (UTC offset)
 */
async function getTimezoneOffset(latitude, longitude, year, month, day) {
  // For now, use a more accurate approximation
  // In production, use a proper timezone API like timezoneapi.io or Google Timezone API

  // Approximate timezone from longitude (rough estimate)
  const baseOffset = Math.round(longitude / 15);

  // Adjust for common timezone boundaries (US-specific for now)
  // This is a simplified version - in production, use a proper timezone database
  let adjustedOffset = baseOffset;

  // US timezone adjustments (simplified)
  if (longitude >= -125 && longitude < -67) {
    // Continental US
    if (longitude >= -125 && longitude < -102) {
      // Pacific Time
      adjustedOffset = -8; // PST base
    } else if (longitude >= -102 && longitude < -87) {
      // Mountain Time
      adjustedOffset = -7; // MST base
    } else if (longitude >= -87 && longitude < -75) {
      // Central Time
      adjustedOffset = -6; // CST base
    } else if (longitude >= -75 && longitude < -67) {
      // Eastern Time
      adjustedOffset = -5; // EST base
    }

    // Check for Daylight Saving Time (simplified - DST rules have changed over time)
    // DST in US: Second Sunday in March to First Sunday in November (since 2007)
    // Before 2007: First Sunday in April to Last Sunday in October
    const date = new Date(year, month - 1, day);
    const isDST = checkDaylightSavingTime(date, year);

    if (isDST) {
      adjustedOffset += 1; // Add 1 hour for DST
    }
  }

  return adjustedOffset;
}

/**
 * Check if a date falls during Daylight Saving Time
 * Simplified version - in production, use a proper timezone library
 *
 * @param {Date} date - The date to check
 * @param {number} year - The year
 * @returns {boolean} True if DST is in effect
 */
function checkDaylightSavingTime(date, year) {
  // DST rules have changed over time, this is a simplified version
  // For accurate results, use a timezone library like moment-timezone or date-fns-tz

  const month = date.getMonth() + 1; // 1-12
  const day = date.getDate();

  // DST in US (simplified):
  // Since 2007: Second Sunday in March to First Sunday in November
  // 1987-2006: First Sunday in April to Last Sunday in October
  // Before 1987: Different rules

  if (year >= 2007) {
    // Second Sunday in March
    const marchDSTStart = getNthSunday(year, 3, 2);
    // First Sunday in November
    const novemberDSTEnd = getNthSunday(year, 11, 1);

    const dateNum = year * 10000 + month * 100 + day;
    const startNum = year * 10000 + 3 * 100 + marchDSTStart;
    const endNum = year * 10000 + 11 * 100 + novemberDSTEnd;

    return dateNum >= startNum && dateNum < endNum;
  } else if (year >= 1987) {
    // First Sunday in April
    const aprilDSTStart = getNthSunday(year, 4, 1);
    // Last Sunday in October
    const octoberDSTEnd = getLastSunday(year, 10);

    const dateNum = year * 10000 + month * 100 + day;
    const startNum = year * 10000 + 4 * 100 + aprilDSTStart;
    const endNum = year * 10000 + 10 * 100 + octoberDSTEnd;

    return dateNum >= startNum && dateNum <= endNum;
  }

  // For years before 1987, DST rules were different
  // This is a simplified fallback
  return month >= 4 && month <= 10;
}

/**
 * Get the nth Sunday of a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @param {number} n - Which Sunday (1 = first, 2 = second, etc.)
 * @returns {number} Day of month
 */
function getNthSunday(year, month, n) {
  const firstDay = new Date(year, month - 1, 1);
  const firstSunday = 1 + ((7 - firstDay.getDay()) % 7);
  return firstSunday + (n - 1) * 7;
}

/**
 * Get the last Sunday of a month
 * @param {number} year - Year
 * @param {number} month - Month (1-12)
 * @returns {number} Day of month
 */
function getLastSunday(year, month) {
  const lastDay = new Date(year, month, 0); // Last day of month
  const dayOfWeek = lastDay.getDay();
  return lastDay.getDate() - dayOfWeek;
}

module.exports = {
  getTimezoneOffset,
  checkDaylightSavingTime,
};
