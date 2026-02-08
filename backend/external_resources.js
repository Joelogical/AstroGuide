// External resource access for astrology bot
// This module provides functions to fetch external resources that can be used
// to enhance AI responses with up-to-date information

const axios = require("axios");
let cheerio;
try {
  cheerio = require("cheerio");
} catch (error) {
  console.warn("[EXTERNAL] Cheerio not available, HTML parsing will be limited");
}
require("dotenv").config();

// AstrologyAPI.com credentials
const USER_ID = process.env.ASTROLOGY_API_USER_ID;
const API_KEY = process.env.ASTROLOGY_API_KEY;

// Google Custom Search API (optional - for web search)
const GOOGLE_SEARCH_API_KEY = process.env.GOOGLE_SEARCH_API_KEY;
const GOOGLE_SEARCH_ENGINE_ID = process.env.GOOGLE_SEARCH_ENGINE_ID;

// Reputable astrology websites to search
const REPUTABLE_ASTROLOGY_SITES = [
  "astrology.com",
  "cafeastrology.com",
  "astro.com",
  "astrostyle.com",
  "astrologyzone.com",
  "astro-seek.com",
  "astrotheme.com",
  "timeanddate.com/astronomy",
  "lindagoodman.com",
  "susanmiller.com",
];

/**
 * Generate AstrologyAPI.com authentication header
 */
function generateAuth() {
  const credentials = Buffer.from(`${USER_ID}:${API_KEY}`).toString("base64");
  return {
    Authorization: `Basic ${credentials}`,
    "Content-Type": "application/json",
  };
}

/**
 * Fetch current planetary positions (for transits, current events)
 * @param {string} date - Optional date in ISO format (YYYY-MM-DD). Defaults to today.
 * @returns {Promise<object>} Current planetary data
 */
async function fetchCurrentPlanetaryPositions(date = null) {
  try {
    const targetDate = date ? new Date(date) : new Date();
    const day = targetDate.getDate();
    const month = targetDate.getMonth() + 1;
    const year = targetDate.getFullYear();
    const hour = targetDate.getHours();
    const minute = targetDate.getMinutes();

    // Use a default location (Greenwich, UK) for current transits
    // In production, you might want to use user's location or a standard location
    const lat = 51.5074; // London
    const lon = -0.1278;
    const tzone = 0; // UTC

    console.log(
      `[EXTERNAL] Fetching current planetary positions for ${year}-${month}-${day}`
    );

    // Fetch current planetary positions from AstrologyAPI.com
    const response = await axios.post(
      "https://json.astrologyapi.com/v1/planets/tropical",
      {
        day: day,
        month: month,
        year: year,
        hour: hour,
        min: minute,
        lat: lat,
        lon: lon,
        tzone: tzone,
      },
      {
        headers: generateAuth(),
      }
    );

    if (response.data && Array.isArray(response.data)) {
      // Format the data for AI consumption
      const planets = {};
      response.data.forEach((planet) => {
        planets[planet.name] = {
          sign: planet.sign,
          degree: planet.fullDegree,
          house: planet.house,
          isRetrograde: planet.isRetro === "true",
        };
      });

      return {
        date: `${year}-${month}-${day}`,
        time: `${hour}:${minute}`,
        planets: planets,
        summary: `Current planetary positions as of ${year}-${month}-${day}: ${Object.keys(planets).join(", ")}`,
      };
    }

    return {
      date: `${year}-${month}-${day}`,
      error: "Could not fetch planetary positions",
    };
  } catch (error) {
    console.error("Error fetching current planetary positions:", error);
    return {
      error: "Failed to fetch current planetary positions",
      message: error.message,
    };
  }
}

/**
 * Search for astrology information. WEB IS PRIMARY for interpretations.
 * Local knowledge is used only for supplementary facts and fallback.
 * @param {string} query - Search query
 * @returns {Promise<string>} Relevant information
 */
async function searchAstrologyInfo(query) {
  try {
    console.log(`[EXTERNAL] Searching for: ${query} (web as primary source)`);

    // 1. WEB FIRST – primary source for interpretations and detailed content
    const webResults = await searchWebForAstrology(query);
    const {
      getPlanetMeaning,
      getSignMeaning,
      getHouseMeaning,
    } = require("./astrology_rules");
    const lowerQuery = query.toLowerCase();
    const planets = ["sun", "moon", "mercury", "venus", "mars", "jupiter", "saturn", "uranus", "neptune", "pluto"];
    const signs = ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"];

    // Build optional local "reference facts" (brief – hardcoding = facts only)
    let localFacts = "";
    const matchedPlanet = planets.find((p) => lowerQuery.includes(p));
    const matchedSign = signs.find((s) => lowerQuery.includes(s));
    const houseMatch = lowerQuery.match(/house\s*(\d+)/);
    if (matchedPlanet) {
      const planetInfo = getPlanetMeaning(matchedPlanet, "positive");
      if (planetInfo) localFacts += `[Reference] ${matchedPlanet.toUpperCase()}: ${planetInfo.core}. Keywords: ${(planetInfo.keywords || []).slice(0, 5).join(", ")}\n`;
    }
    if (matchedSign) {
      const signInfo = getSignMeaning(matchedSign.charAt(0).toUpperCase() + matchedSign.slice(1), "positive");
      if (signInfo) localFacts += `[Reference] ${matchedSign.toUpperCase()}: ${(signInfo.core || "").slice(0, 120)}\n`;
    }
    if (houseMatch) {
      const houseNum = parseInt(houseMatch[1], 10);
      if (houseNum >= 1 && houseNum <= 12) {
        const houseInfo = getHouseMeaning(houseNum, "positive");
        if (houseInfo) localFacts += `[Reference] House ${houseNum}: ${(houseInfo.core || "").slice(0, 120)}\n`;
      }
    }

    if (webResults) {
      const out = `WEB-SOURCED INTERPRETATIONS (primary):\n\n${webResults}`;
      if (localFacts) return `${out}\n\n--- Reference facts (local) ---\n${localFacts}`;
      return out;
    }

    // 2. FALLBACK – local knowledge only when web returns nothing
    for (const planet of planets) {
      for (const sign of signs) {
        if (lowerQuery.includes(planet) && lowerQuery.includes(sign)) {
          const planetInfo = getPlanetMeaning(planet, "positive");
          const signInfo = getSignMeaning(sign.charAt(0).toUpperCase() + sign.slice(1), "positive");
          if (planetInfo && signInfo) {
            return `[Fallback – no web results] ${planet.toUpperCase()} in ${sign.toUpperCase()}: ${planetInfo.core} expressed through ${signInfo.core || "N/A"}. Themes: ${(planetInfo.themes || []).slice(0, 2).join(", ")}; ${(signInfo.themes || []).slice(0, 2).join(", ")}. For richer interpretation, consult professional astrology sources.`;
          }
        }
      }
    }
    if (matchedPlanet) {
      const planetInfo = getPlanetMeaning(matchedPlanet, "positive");
      if (planetInfo) return `Planet: ${matchedPlanet.toUpperCase()}\nCore: ${planetInfo.core}\nThemes: ${(planetInfo.themes || []).slice(0, 5).join(", ")}`;
    }
    if (matchedSign) {
      const signInfo = getSignMeaning(matchedSign.charAt(0).toUpperCase() + matchedSign.slice(1), "positive");
      if (signInfo) return `Sign: ${matchedSign.toUpperCase()}\nCore: ${signInfo.core || "N/A"}\nThemes: ${(signInfo.themes || []).slice(0, 5).join(", ")}`;
    }
    if (houseMatch) {
      const houseNum = parseInt(houseMatch[1], 10);
      if (houseNum >= 1 && houseNum <= 12) {
        const houseInfo = getHouseMeaning(houseNum, "positive");
        if (houseInfo) return `House ${houseNum}: ${houseInfo.core || "N/A"}\nThemes: ${(houseInfo.themes || []).slice(0, 5).join(", ")}`;
      }
    }

    return `No web or local data found for "${query}". Consider rephrasing or consulting reputable astrology sites: ${REPUTABLE_ASTROLOGY_SITES.slice(0, 5).join(", ")}.`;
  } catch (error) {
    console.error("Error searching astrology info:", error);
    return `Search failed for "${query}". Please try rephrasing.`;
  }
}

/**
 * Gather interpretation content from the web for a birth chart (primary source for chart reading).
 * Uses a broad set of placement-based queries to pull from many sources.
 * @param {object} birthChart - Processed birth chart with planets, angles, houses
 * @returns {Promise<string>} Combined web-sourced interpretation text
 */
async function gatherChartInterpretationsFromWeb(birthChart) {
  const queries = [];
  const seen = new Set();

  if (birthChart.planets) {
    for (const [name, data] of Object.entries(birthChart.planets)) {
      const sign = data.sign && data.sign.toLowerCase ? data.sign.toLowerCase() : (data.sign || "");
      const house = data.house != null ? data.house : "";
      const label = name + sign + String(house);
      if (!sign || seen.has(label)) continue;
      seen.add(label);
      const planetLabel = name.charAt(0).toUpperCase() + name.slice(1);
      queries.push({ q: `${planetLabel} in ${sign} interpretation meaning`, key: `${planetLabel} in ${sign}` });
      if (house >= 1 && house <= 12) queries.push({ q: `${planetLabel} in house ${house} meaning`, key: `${planetLabel} house ${house}` });
    }
  }
  if (birthChart.angles) {
    const asc = birthChart.angles.ascendant;
    const mc = birthChart.angles.midheaven;
    if (asc && asc.sign) {
      const s = asc.sign.toLowerCase();
      if (!seen.has("asc" + s)) { seen.add("asc" + s); queries.push({ q: `Ascendant ${asc.sign} meaning interpretation`, key: `Ascendant in ${asc.sign}` }); }
    }
    if (mc && mc.sign) {
      const s = mc.sign.toLowerCase();
      if (!seen.has("mc" + s)) { seen.add("mc" + s); queries.push({ q: `Midheaven ${mc.sign} meaning career`, key: `Midheaven in ${mc.sign}` }); }
    }
  }

  // Limit to a diverse set to avoid rate limits and keep response size reasonable
  const toRun = queries.slice(0, 10);
  const results = [];
  for (const { q, key } of toRun) {
    try {
      const text = await searchWebForAstrology(q);
      if (text && text.trim()) results.push(`[${key}]\n${text.trim().slice(0, 1500)}\n`);
    } catch (e) {
      console.warn(`[EXTERNAL] gatherChartInterpretationsFromWeb query failed: ${q}`, e.message);
    }
  }
  if (results.length === 0) return "";
  return "INTERPRETATIONS FROM WEB (use as primary source for chart reading):\n\n" + results.join("\n---\n\n");
}

/**
 * Search the web for reputable astrology information
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results with relevant information
 */
async function searchWebForAstrology(query) {
  try {
    console.log(`[EXTERNAL] Web searching for: ${query}`);
    
    // If Google Custom Search API is configured, use it
    if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID) {
      return await searchWithGoogle(query);
    }
    
    // Otherwise, try searching reputable astrology sites directly
    return await searchReputableSites(query);
  } catch (error) {
    console.error("Error in web search:", error);
    return null;
  }
}

/**
 * Search using Google Custom Search API
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchWithGoogle(query) {
  try {
    // Add site filters for reputable astrology sites
    const siteFilter = REPUTABLE_ASTROLOGY_SITES.map(site => `site:${site}`).join(" OR ");
    const searchQuery = `${query} astrology (${siteFilter})`;
    
    const response = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: GOOGLE_SEARCH_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        q: searchQuery,
        num: 5, // Get top 5 results
      },
      timeout: 10000,
    });
    
    if (response.data && response.data.items && response.data.items.length > 0) {
      const results = response.data.items.slice(0, 3); // Use top 3 results
      let combinedResults = `Web search results for "${query}":\n\n`;
      
      for (const item of results) {
        combinedResults += `Source: ${item.title} (${item.link})\n`;
        combinedResults += `Snippet: ${item.snippet}\n\n`;
      }
      
      return combinedResults;
    }
    
    return null;
  } catch (error) {
    console.error("Google Custom Search error:", error.message);
    return null;
  }
}

/**
 * Search reputable astrology sites directly (fallback method)
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchReputableSites(query) {
  // This is a simplified approach - in production, you might want to:
  // 1. Use DuckDuckGo API (no key required)
  // 2. Scrape specific pages from reputable sites
  // 3. Use Wikipedia API for astrology topics
  
  try {
    // Try Wikipedia API first (free, no key required)
    const wikiResult = await searchWikipedia(query);
    if (wikiResult) {
      return wikiResult;
    }
    
    // Return a message suggesting reputable sources
    return `For detailed information about "${query}", I recommend consulting these reputable astrology sources:\n\n` +
           REPUTABLE_ASTROLOGY_SITES.slice(0, 5).map(site => `- ${site}`).join("\n") +
           `\n\nYou can search these sites directly for professional interpretations and detailed explanations.`;
  } catch (error) {
    console.error("Error searching reputable sites:", error);
    return null;
  }
}

/**
 * Search Wikipedia for astrology information
 * @param {string} query - Search query
 * @returns {Promise<string|null>} Wikipedia content
 */
async function searchWikipedia(query) {
  try {
    // Search Wikipedia API
    const searchResponse = await axios.get("https://en.wikipedia.org/api/rest_v1/page/summary/" + 
      encodeURIComponent(query + " astrology"), {
      timeout: 5000,
    });
    
    if (searchResponse.data && searchResponse.data.extract) {
      return `Wikipedia information about "${query}":\n\n${searchResponse.data.extract}\n\nSource: ${searchResponse.data.content_urls?.desktop?.page || "Wikipedia"}`;
    }
    
    return null;
  } catch (error) {
    // Wikipedia search failed, that's okay
    return null;
  }
}

/**
 * Fetch astrology article or resource by URL
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} Article content
 */
async function fetchAstrologyArticle(url) {
  try {
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      timeout: 10000,
    });
    
    // Use cheerio to parse HTML if available
    if (cheerio) {
      const $ = cheerio.load(response.data);
      
      // Remove script and style elements
      $("script, style").remove();
      
      // Extract main content (try common content selectors)
      let content = "";
      const contentSelectors = ["article", ".content", ".post", ".entry", "main", "body"];
      
      for (const selector of contentSelectors) {
        const element = $(selector).first();
        if (element.length > 0) {
          content = element.text().trim();
          if (content.length > 500) break; // Found substantial content
        }
      }
      
      // If no specific content found, get body text
      if (!content || content.length < 500) {
        content = $("body").text().trim();
      }
      
      // Clean up whitespace
      content = content.replace(/\s+/g, " ").substring(0, 3000); // Limit to 3000 chars
      
      return content || response.data.substring(0, 2000);
    } else {
      // Fallback: return raw HTML substring if cheerio not available
      return response.data.substring(0, 2000);
    }
  } catch (error) {
    console.error(`Error fetching article from ${url}:`, error.message);
    return null;
  }
}

/**
 * Get function definitions for OpenAI function calling
 * These tell the AI what external functions it can call
 * @returns {Array} Array of function definitions
 */
function getFunctionDefinitions() {
  return [
    {
      name: "search_astrology_info",
      description: "Search for professional astrology information, interpretations, and explanations from reputable sources. USE THIS FUNCTION FREQUENTLY when interpreting the user's chart—call it for key placements (e.g. 'Moon in Libra 7th house', 'Sun Scorpio 8th house') to get fresh, varied language and avoid generic phrasing. Also use for: planetary meanings, sign meanings, house meanings, aspect explanations, astrology concepts, transits, returns. The function searches local knowledge and professional astrology websites. DO NOT use for simple factual questions (e.g. 'What sign is my Venus in?')—use the chart data provided instead.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query for astrology information. Be specific and comprehensive. Examples: 'Venus in Scorpio meaning and interpretation', 'Saturn return detailed explanation', 'astrological aspects explained', 'what does the 7th house represent in astrology', 'Scorpio sign characteristics and traits', 'Mars retrograde effects', 'Yod aspect meaning'. Always include the full concept and context (e.g., 'Venus in Scorpio meaning' not just 'Venus').",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "search_web_astrology",
      description: "Search the web specifically for professional astrology information from reputable astrology websites. Use this when you need to find current information, detailed interpretations, or when search_astrology_info doesn't provide enough detail. This searches professional astrology sources like astrology.com, cafeastrology.com, astro.com, and other reputable sites.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query for web astrology information. Be specific about what you're looking for.",
          },
        },
        required: ["query"],
      },
    },
    {
      name: "fetch_current_transits",
      description: "Get current planetary transits and positions. Use this when the user asks about current astrological events, transits affecting them, or what's happening in the sky right now.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Optional date in ISO format (YYYY-MM-DD). If not provided, uses current date.",
          },
        },
        required: [],
      },
    },
    {
      name: "get_astrology_article",
      description: "Fetch a specific astrology article or resource by URL. Use this when you have a specific URL to an astrology resource that would help answer the user's question.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the astrology article or resource to fetch",
          },
        },
        required: ["url"],
      },
    },
  ];
}

/**
 * Execute a function call requested by the AI
 * @param {string} functionName - Name of the function to call
 * @param {object} functionArgs - Arguments for the function
 * @returns {Promise<any>} Function result
 */
async function executeFunction(functionName, functionArgs) {
  console.log(`[EXTERNAL] Executing function: ${functionName}`, functionArgs);
  
  switch (functionName) {
    case "search_astrology_info":
      return await searchAstrologyInfo(functionArgs.query);
      
    case "search_web_astrology":
      return await searchWebForAstrology(functionArgs.query);
      
    case "fetch_current_transits":
      return await fetchCurrentPlanetaryPositions(functionArgs.date || null);
      
    case "get_astrology_article":
      return await fetchAstrologyArticle(functionArgs.url);
      
    default:
      throw new Error(`Unknown function: ${functionName}`);
  }
}

module.exports = {
  fetchCurrentPlanetaryPositions,
  searchAstrologyInfo,
  searchWebForAstrology,
  gatherChartInterpretationsFromWeb,
  fetchAstrologyArticle,
  getFunctionDefinitions,
  executeFunction,
};
