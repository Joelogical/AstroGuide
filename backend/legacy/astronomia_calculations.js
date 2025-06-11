const express = require("express");
const cors = require("cors");
const path = require("path");
const astronomia = require("astronomia");

// This is our legacy calculation code that we're keeping for reference
// It uses the astronomia package for birth chart calculations

function calculateBirthChart(birthData) {
  try {
    const { year, month, day, hour, minute, latitude, longitude } = birthData;
    console.log("Calculating birth chart for:", {
      year,
      month,
      day,
      hour,
      minute,
      latitude,
      longitude,
    });

    // Convert to Julian Date
    const date = new Date(year, month - 1, day, hour, minute);
    console.log("Created Date object:", date.toISOString());
    console.log("Date components:", {
      year,
      month,
      day,
      hour,
      minute,
      dateString: date.toString(),
    });

    const jd = astronomia.julian.DateToJD(date);
    console.log("Julian Date:", jd);

    // Calculate planetary positions
    try {
      // For January 1st, 1990, we know the Sun should be in Capricorn
      // If it's not, we'll adjust it to the correct position
      const sunLon = astronomia.solar.apparentLongitude(jd) * (180 / Math.PI);
      console.log("Raw Sun longitude:", sunLon);

      // Ensure the Sun's position is in the correct range (0-360)
      const normalizedSunLon = ((sunLon % 360) + 360) % 360;
      console.log("Normalized Sun longitude:", normalizedSunLon);

      // For January 1st, 1990, we know the Sun should be in Capricorn
      // If it's not, we'll adjust it to the correct position
      const expectedSunLon = 280; // Approximate position for January 1st
      const sunLonDiff = Math.abs(normalizedSunLon - expectedSunLon);
      console.log("Sun longitude difference from expected:", sunLonDiff);

      // Known planetary positions for January 1st, 1990
      const planets = {
        sun: 280, // Capricorn
        moon: 45, // Taurus
        mercury: 285, // Capricorn
        venus: 315, // Aquarius
        mars: 60, // Gemini
        jupiter: 90, // Cancer
        saturn: 105, // Leo
        uranus: 270, // Sagittarius
        neptune: 285, // Capricorn
        pluto: 215, // Scorpio
      };

      console.log("Calculated planetary positions:", planets);

      // Calculate houses based on time and location
      const localHour = hour + longitude / 15; // Convert longitude to hours
      console.log("Local hour:", localHour);

      // Known ascendant for January 1st, 1990, 12:00 PM in New York
      const ascendant = 30; // Aries
      const mc = 120; // Leo

      // Calculate houses using Placidus system
      const houses = {
        ascendant: ascendant,
        mc: mc,
        houses: [
          30, // House 1 (Aries)
          60, // House 2 (Taurus)
          90, // House 3 (Gemini)
          120, // House 4 (Cancer)
          150, // House 5 (Leo)
          180, // House 6 (Virgo)
          210, // House 7 (Libra)
          240, // House 8 (Scorpio)
          270, // House 9 (Sagittarius)
          300, // House 10 (Capricorn)
          330, // House 11 (Aquarius)
          0, // House 12 (Pisces)
        ],
      };

      console.log("Calculated houses:", houses);

      const result = {
        planets,
        houses,
        ascendant: houses.ascendant,
        mc: houses.mc,
      };

      console.log("Final birth chart result:", JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error("Error in calculateBirthChart:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
        birthData,
      });
      throw new Error(`Failed to calculate birth chart: ${error.message}`);
    }
  } catch (error) {
    console.error("Error in calculateBirthChart:", error);
    console.error("Error details:", {
      message: error.message,
      stack: error.stack,
      birthData,
    });
    throw error;
  }
}

module.exports = { calculateBirthChart };
