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

// Comprehensive astrology sources - blogs, forums, niche sites, and mainstream
const ASTROLOGY_SOURCES = {
  // Mainstream professional sites
  mainstream: [
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
    "astrostyle.com",
    "chani.com",
    "thecut.com/astrology",
    "cosmopolitan.com/astrology",
    "elle.com/astrology",
  ],
  // Popular astrology blogs
  blogs: [
    "astrostyle.com",
    "chani.com",
    "theastrologypodcast.com",
    "kellysastrology.com",
    "cafeastrology.com",
    "astrostyle.com/blog",
    "astro.com/astrology",
    "astrologyking.com",
    "astrobutterfly.com",
    "mysticmedusa.com",
    "astrologyanswers.com",
    "wellandgood.com/astrology",
    "mindbodygreen.com/astrology",
    "bustle.com/astrology",
    "refinery29.com/astrology",
  ],
  // Forums and community sites
  forums: [
    "reddit.com/r/astrology",
    "reddit.com/r/AskAstrologers",
    "reddit.com/r/astrologyreadings",
    "astrologyweekly.com/forum",
    "astrology.com/community",
    "cafeastrology.com/forums",
    "astro.com/forum",
  ],
  // Niche and specialized sites
  niche: [
    "astro.com",
    "astro-seek.com",
    "astrotheme.com",
    "astro.com/astrology",
    "astrobutterfly.com",
    "astrologyking.com",
    "theastrologypodcast.com",
    "kellysastrology.com",
    "mysticmedusa.com",
    "astrologyanswers.com",
    "astrostyle.com",
    "chani.com",
    "lindagoodman.com",
    "susanmiller.com",
    "astro.com/horoscope",
    "astro-seek.com/horoscope",
    "astrotheme.com/horoscope",
  ],
};

// Flatten all sources for broader searches
const ALL_ASTROLOGY_SOURCES = [
  ...new Set([
    ...ASTROLOGY_SOURCES.mainstream,
    ...ASTROLOGY_SOURCES.blogs,
    ...ASTROLOGY_SOURCES.forums,
    ...ASTROLOGY_SOURCES.niche,
  ])
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

    return `No web or local data found for "${query}". Consider rephrasing or consulting diverse astrology sources: ${ALL_ASTROLOGY_SOURCES.slice(0, 8).join(", ")}.`;
  } catch (error) {
    console.error("Error searching astrology info:", error);
    return `Search failed for "${query}". Please try rephrasing.`;
  }
}

/**
 * Gather interpretation content from the web for a birth chart (primary source for chart reading).
 * Uses a broad set of holistic queries to pull from diverse sources (blogs, forums, niche sites).
 * @param {object} birthChart - Processed birth chart with planets, angles, houses
 * @returns {Promise<string>} Combined web-sourced interpretation text
 */
async function gatherChartInterpretationsFromWeb(birthChart) {
  const queries = [];
  const seen = new Set();

  // Generate holistic queries that combine multiple chart elements
  if (birthChart.planets) {
    for (const [name, data] of Object.entries(birthChart.planets)) {
      const sign = data.sign && data.sign.toLowerCase ? data.sign.toLowerCase() : (data.sign || "");
      const house = data.house != null ? data.house : "";
      const label = name + sign + String(house);
      if (!sign || seen.has(label)) continue;
      seen.add(label);
      const planetLabel = name.charAt(0).toUpperCase() + name.slice(1);
      
      // Query for planet-sign placement (prioritize personal planets)
      const isPersonalPlanet = ["sun", "moon", "mercury", "venus", "mars"].includes(name);
      queries.push({ 
        q: `${planetLabel} in ${sign} interpretation meaning holistic`, 
        key: `${planetLabel} in ${sign}`,
        priority: isPersonalPlanet ? 1 : 2 // Personal planets get priority 1
      });
      
      // Only query house placements for personal planets to reduce total queries
      if (isPersonalPlanet && house >= 1 && house <= 12) {
        queries.push({ 
          q: `${planetLabel} in ${sign} ${house}th house meaning interpretation`, 
          key: `${planetLabel} in ${sign} house ${house}`,
          priority: 2
        });
      }
      
      // Add holistic combination queries (only for Sun-Moon to reduce queries)
      if (name === "sun" && birthChart.planets.moon) {
        const moonSign = birthChart.planets.moon.sign?.toLowerCase() || "";
        if (moonSign) {
          queries.push({
            q: `Sun ${sign} Moon ${moonSign} combination interpretation`,
            key: `Sun-Moon combination`,
            priority: 1
          });
        }
      }
    }
  }
  
  if (birthChart.angles) {
    const asc = birthChart.angles.ascendant;
    const mc = birthChart.angles.midheaven;
    if (asc && asc.sign) {
      const s = asc.sign.toLowerCase();
      if (!seen.has("asc" + s)) { 
        seen.add("asc" + s); 
        queries.push({ 
          q: `Ascendant ${asc.sign} rising sign meaning interpretation holistic`, 
          key: `Ascendant in ${asc.sign}`,
          priority: 1
        }); 
      }
    }
    if (mc && mc.sign) {
      const s = mc.sign.toLowerCase();
      if (!seen.has("mc" + s)) { 
        seen.add("mc" + s); 
        queries.push({ 
          q: `Midheaven ${mc.sign} MC meaning career public image`, 
          key: `Midheaven in ${mc.sign}`,
          priority: 2
        }); 
      }
    }
  }
  
  // Add aspect pattern queries for holistic interpretation
  if (birthChart.aspects && Array.isArray(birthChart.aspects)) {
    const majorAspects = birthChart.aspects.filter(a => 
      ["conjunction", "opposition", "square", "trine", "sextile"].includes(a.aspect?.toLowerCase())
    );
    
    if (majorAspects.length > 0) {
      // Query for major aspect patterns (reduced to top 2 most important aspects)
      const aspectQueries = [];
      majorAspects.slice(0, 2).forEach(aspect => { // Reduced from 5 to 2
        if (aspect.planet1 && aspect.planet2 && aspect.aspect) {
          // Only include aspects involving personal planets (Sun, Moon, Mercury, Venus, Mars)
          const personalPlanets = ["sun", "moon", "mercury", "venus", "mars"];
          const p1 = aspect.planet1?.toLowerCase();
          const p2 = aspect.planet2?.toLowerCase();
          if (personalPlanets.includes(p1) || personalPlanets.includes(p2)) {
            aspectQueries.push({
              q: `${aspect.planet1} ${aspect.aspect} ${aspect.planet2} aspect meaning interpretation`,
              key: `${aspect.planet1}-${aspect.planet2} ${aspect.aspect}`,
              priority: 2
            });
          }
        }
      });
      queries.push(...aspectQueries);
    }
  }

  // Sort by priority and limit to balanced set (reduced for speed)
  queries.sort((a, b) => (a.priority || 3) - (b.priority || 3));
  const toRun = queries.slice(0, 8); // Reduced from 15 to 8 for better speed/diversity balance
  
  // Execute searches in parallel batches for efficiency (smaller batches, faster)
  const batchSize = 4; // Increased batch size for faster processing
  const results = [];
  
  // Add timeout wrapper for each search
  const searchWithTimeout = async (q, key) => {
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 8000)
      );
      const searchPromise = searchWebForAstrology(q);
      const text = await Promise.race([searchPromise, timeoutPromise]);
      return { key, text: text?.trim() || "" };
    } catch (e) {
      console.warn(`[EXTERNAL] gatherChartInterpretationsFromWeb query failed: ${q}`, e.message);
      return { key, text: "" };
    }
  };
  
  for (let i = 0; i < toRun.length; i += batchSize) {
    const batch = toRun.slice(i, i + batchSize);
    const batchPromises = batch.map(({ q, key }) => searchWithTimeout(q, key));
    
    const batchResults = await Promise.all(batchPromises);
    batchResults.forEach(({ key, text }) => {
      if (text && text.length > 100) {
        results.push(`[${key}]\n${text.slice(0, 1500)}\n`); // Reduced from 2000 to 1500 for speed
      }
    });
    
    // Reduced delay between batches for faster processing
    if (i + batchSize < toRun.length) {
      await new Promise(resolve => setTimeout(resolve, 200)); // Reduced from 500ms to 200ms
    }
  }
  
  if (results.length === 0) return "";
  
  return "HOLISTIC INTERPRETATIONS FROM DIVERSE WEB SOURCES (blogs, forums, niche sites, mainstream - use as PRIMARY source, minimize hardcoded rules):\n\n" + 
         results.join("\n---\n\n") +
         "\n\nNOTE: These interpretations come from diverse astrology sources including blogs, forums, and niche sites. Synthesize these perspectives holistically rather than relying on hardcoded rules.";
}

/**
 * Search the web for reputable astrology information
 * Optimized for speed while maintaining diversity
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results with relevant information
 */
async function searchWebForAstrology(query) {
  try {
    console.log(`[EXTERNAL] Web searching for: ${query} (optimized search)`);
    
    // Use a timeout wrapper to prevent long waits
    const withTimeout = (promise, timeoutMs) => {
      return Promise.race([
        promise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), timeoutMs)
        )
      ]);
    };
    
    // Try primary search method first (fastest path)
    if (GOOGLE_SEARCH_API_KEY && GOOGLE_SEARCH_ENGINE_ID) {
      try {
        const result = await withTimeout(searchWithGoogle(query), 6000);
        if (result) return result;
      } catch (err) {
        console.warn(`[EXTERNAL] Google search timed out or failed, trying fallback`);
      }
    }
    
    // Fallback: DuckDuckGo (free, no key needed) - single fast search
    try {
      const result = await withTimeout(searchWithDuckDuckGo(query), 5000);
      if (result) return result;
    } catch (err) {
      console.warn(`[EXTERNAL] DuckDuckGo search timed out or failed`);
    }
    
    // Last resort: Wikipedia (fast, reliable)
    try {
      const result = await withTimeout(searchWikipedia(query), 3000);
      if (result) return result;
    } catch (err) {
      console.warn(`[EXTERNAL] Wikipedia search timed out or failed`);
    }
    
    return null;
  } catch (error) {
    console.error("Error in web search:", error);
    return null;
  }
}

/**
 * Search using Google Custom Search API - BROAD SEARCH across all astrology sources
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchWithGoogle(query) {
  try {
    // BROAD SEARCH: Don't limit to specific sites - search the entire web for astrology content
    // This allows finding blogs, forums, niche sites, and diverse perspectives
    const searchQuery = `${query} astrology`;
    
    // First, do a broad web search (no site restrictions)
    const broadResponse = await axios.get("https://www.googleapis.com/customsearch/v1", {
      params: {
        key: GOOGLE_SEARCH_API_KEY,
        cx: GOOGLE_SEARCH_ENGINE_ID,
        q: searchQuery,
        num: 5, // Reduced from 10 to 5 for speed
      },
      timeout: 5000, // Reduced from 10000 to 5000ms
    });
    
    const results = [];
    
    if (broadResponse.data && broadResponse.data.items && broadResponse.data.items.length > 0) {
      // Use top 5 results (reduced from 8) for balance of diversity and speed
      const broadResults = broadResponse.data.items.slice(0, 5);
      
      for (const item of broadResults) {
        // Filter for astrology-related results
        const url = (item.link || "").toLowerCase();
        const title = (item.title || "").toLowerCase();
        const snippet = (item.snippet || "").toLowerCase();
        
        const isAstrologyRelated = 
          url.includes("astrology") || 
          url.includes("astro") ||
          url.includes("horoscope") ||
          title.includes("astrology") ||
          title.includes("astro") ||
          snippet.includes("astrology") ||
          snippet.includes("planet") ||
          snippet.includes("zodiac") ||
          snippet.includes("sign");
        
        if (isAstrologyRelated) {
          results.push({
            title: item.title,
            link: item.link,
            snippet: item.snippet,
            source: categorizeSource(item.link),
          });
        }
      }
    }
    
    // If we have good results, return them
    if (results.length > 0) {
      let combinedResults = `Web search results for "${query}" (from diverse astrology sources):\n\n`;
      
      // Group by source type for better organization
      const bySource = { mainstream: [], blogs: [], forums: [], niche: [], other: [] };
      results.forEach(r => {
        const category = r.source || "other";
        if (bySource[category]) {
          bySource[category].push(r);
        } else {
          bySource.other.push(r);
        }
      });
      
      // Present results with source diversity (limited to 5 for speed)
      let resultCount = 0;
      for (const [category, items] of Object.entries(bySource)) {
        if (items.length > 0 && resultCount < 5) {
          for (const item of items.slice(0, 2)) { // Max 2 per category
            combinedResults += `[${category.toUpperCase()}] ${item.title}\n`;
            combinedResults += `Source: ${item.link}\n`;
            combinedResults += `${item.snippet}\n\n`;
            resultCount++;
            if (resultCount >= 5) break; // Reduced from 8 to 5
          }
        }
        if (resultCount >= 5) break; // Reduced from 8 to 5
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
 * Categorize a source URL
 * @param {string} url - URL to categorize
 * @returns {string} Category name
 */
function categorizeSource(url) {
  if (!url) return "other";
  const lowerUrl = url.toLowerCase();
  
  if (lowerUrl.includes("reddit.com")) return "forums";
  if (lowerUrl.includes("forum")) return "forums";
  if (lowerUrl.includes("blog")) return "blogs";
  if (lowerUrl.includes("chani.com") || lowerUrl.includes("astrobutterfly") || 
      lowerUrl.includes("astrologyking") || lowerUrl.includes("mysticmedusa")) return "niche";
  if (lowerUrl.includes("astrology.com") || lowerUrl.includes("cafeastrology") || 
      lowerUrl.includes("astro.com") || lowerUrl.includes("astrostyle")) return "mainstream";
  
  return "other";
}

/**
 * Search using DuckDuckGo (free, no API key required)
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchWithDuckDuckGo(query) {
  try {
    const searchQuery = `${query} astrology`;
    const response = await axios.get("https://api.duckduckgo.com/", {
      params: {
        q: searchQuery,
        format: "json",
        no_html: "1",
        skip_disambig: "1",
      },
      timeout: 4000, // Reduced from 8000 to 4000ms
    });
    
    if (response.data && response.data.RelatedTopics && response.data.RelatedTopics.length > 0) {
      let results = `DuckDuckGo search results for "${query}":\n\n`;
      response.data.RelatedTopics.slice(0, 3).forEach((topic, idx) => { // Reduced from 5 to 3
        if (topic.Text) {
          results += `${idx + 1}. ${topic.Text}\n`;
          if (topic.FirstURL) results += `   Source: ${topic.FirstURL}\n`;
          results += "\n";
        }
      });
      return results;
    }
    
    return null;
  } catch (error) {
    console.error("DuckDuckGo search error:", error.message);
    return null;
  }
}

/**
 * Search Reddit for astrology discussions
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchReddit(query) {
  try {
    const subreddits = ["astrology", "AskAstrologers", "astrologyreadings"];
    const results = [];
    
    for (const subreddit of subreddits) {
      try {
        const response = await axios.get(`https://www.reddit.com/r/${subreddit}/search.json`, {
          params: {
            q: query,
            restrict_sr: "1",
            limit: 3,
            sort: "relevance",
          },
          headers: {
            "User-Agent": "AstroGuide/1.0",
          },
          timeout: 5000,
        });
        
        if (response.data && response.data.data && response.data.data.children) {
          response.data.data.children.forEach((post) => {
            if (post.data && post.data.selftext) {
              results.push({
                title: post.data.title,
                subreddit: subreddit,
                content: post.data.selftext.substring(0, 500),
                url: `https://reddit.com${post.data.permalink}`,
              });
            }
          });
        }
      } catch (err) {
        // Continue to next subreddit if one fails
        console.warn(`Reddit search failed for r/${subreddit}:`, err.message);
      }
    }
    
    if (results.length > 0) {
      let redditResults = `Reddit community discussions about "${query}":\n\n`;
      results.slice(0, 5).forEach((result, idx) => {
        redditResults += `[r/${result.subreddit}] ${result.title}\n`;
        redditResults += `${result.content}...\n`;
        redditResults += `Source: ${result.url}\n\n`;
      });
      return redditResults;
    }
    
    return null;
  } catch (error) {
    console.error("Reddit search error:", error.message);
    return null;
  }
}

/**
 * Search reputable astrology sites directly (fallback method)
 * Uses multiple search methods in parallel for maximum coverage
 * @param {string} query - Search query
 * @returns {Promise<string>} Search results
 */
async function searchReputableSites(query) {
  try {
    // Try multiple search methods in parallel for maximum diversity
    const searchPromises = [
      searchWikipedia(query),
      searchWithDuckDuckGo(query),
      searchReddit(query),
    ];
    
    const results = await Promise.allSettled(searchPromises);
    const successfulResults = [];
    
    results.forEach((result, idx) => {
      if (result.status === "fulfilled" && result.value) {
        successfulResults.push(result.value);
      }
    });
    
    if (successfulResults.length > 0) {
      return successfulResults.join("\n\n---\n\n");
    }
    
    // Return a message suggesting diverse sources
    return `For detailed information about "${query}", I recommend consulting diverse astrology sources:\n\n` +
           `Mainstream: ${ASTROLOGY_SOURCES.mainstream.slice(0, 3).join(", ")}\n` +
           `Blogs: ${ASTROLOGY_SOURCES.blogs.slice(0, 3).join(", ")}\n` +
           `Forums: Reddit r/astrology, r/AskAstrologers\n` +
           `Niche: ${ASTROLOGY_SOURCES.niche.slice(0, 3).join(", ")}\n\n` +
           `You can search these sites directly for professional interpretations and diverse perspectives.`;
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
      description: "Search for professional astrology information from DIVERSE sources (blogs, forums, niche sites, mainstream). USE THIS FUNCTION EXTENSIVELY—call it for EVERY key placement, aspect, and combination when interpreting charts. This searches blogs, forums, Reddit, niche astrology sites, and mainstream sources for holistic, varied perspectives. MINIMIZE use of hardcoded rules—web sources are PRIMARY. Use for: all planetary placements, sign meanings, house meanings, aspect explanations, chart combinations, astrology concepts, transits, returns. DO NOT use for simple factual questions (e.g. 'What sign is my Venus in?')—use the chart data provided instead.",
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
      description: "Search the web broadly for astrology information from DIVERSE sources including blogs, forums (Reddit), niche sites, and mainstream astrology websites. Use this for comprehensive, holistic interpretations that draw from multiple perspectives. This searches blogs, forums, niche astrology sites, and mainstream sources to provide varied, non-generic interpretations. Prefer this over hardcoded rules for all interpretation needs.",
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
    {
      name: "update_profile_memory",
      description: "Save what you learned about this person so the app can remember for future messages. Call this when the user shares life themes, goals, preferences, or after you give a substantial interpretation. Use short, clear labels (e.g. 'career/10th house', 'relationship patterns', 'focus on strengths'). This makes the chat feel continuous and premium—you can later say things like 'Earlier we discussed your career pattern; this connects to that same 10th house theme.'",
      parameters: {
        type: "object",
        properties: {
          lifeThemesDiscussed: {
            type: "array",
            items: { type: "string" },
            description: "Life themes or chart themes already discussed (e.g. 'career/10th house', 'Moon in Cancer', 'Venus-Mars aspects'). Short labels.",
          },
          userGoals: {
            type: "array",
            items: { type: "string" },
            description: "Goals or interests the user has mentioned (e.g. 'understand relocation', 'relationship timing').",
          },
          sensitivityFlags: {
            type: "array",
            items: { type: "string" },
            description: "Sensitivity preferences (e.g. 'softer language', 'focus on strengths', 'avoid prediction'). Only if the user has expressed these.",
          },
          priorTopicsSummary: {
            type: "string",
            description: "Optional one-sentence summary of what has been covered so far, for continuity.",
          },
        },
        required: [],
      },
    },
    {
      name: "save_chart_summary",
      description: "Save a reusable summary of this person's chart so the app can reuse it in later prompts instead of rediscovering them each time. Call this ONCE after your first substantive full-chart interpretation (e.g. when they ask 'tell me about myself' or 'interpret my chart'). Use the chart to fill in: personality summary, emotional style, relationship style, work style, strengths, blind spots, recurring life themes, timing tendencies. Keep each field to 1-3 short sentences. If the user already has a STORED CHART SUMMARY in the prompt, do NOT call this again—use that summary.",
      parameters: {
        type: "object",
        properties: {
          personalitySummary: { type: "string", description: "1-3 sentences: core personality and identity from the chart." },
          emotionalStyle: { type: "string", description: "1-3 sentences: how they process and express emotions." },
          relationshipStyle: { type: "string", description: "1-3 sentences: how they approach partnerships and connection." },
          workStyle: { type: "string", description: "1-3 sentences: approach to career, ambition, and daily work." },
          strengths: { type: "string", description: "1-3 sentences or short list: chart-backed strengths and gifts." },
          blindSpots: { type: "string", description: "1-3 sentences or short list: recurring blind spots or growth edges." },
          recurringLifeThemes: { type: "string", description: "1-3 sentences: recurring life themes (e.g. authority, belonging, change)." },
          timingTendencies: { type: "string", description: "1-3 sentences: tendencies around timing, cycles, or when things tend to unfold." },
        },
        required: ["personalitySummary", "emotionalStyle", "relationshipStyle", "workStyle", "strengths", "blindSpots", "recurringLifeThemes", "timingTendencies"],
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

    case "update_profile_memory":
      return JSON.stringify({ acknowledged: true, message: "Profile memory will be updated for future messages." });

    case "save_chart_summary":
      return JSON.stringify({ acknowledged: true, message: "Chart summary stored; will be reused in future prompts." });

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
