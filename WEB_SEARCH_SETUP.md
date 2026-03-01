# Web Search Setup Guide

## Overview

The astrology bot now has enhanced web search capabilities to access professional astrology sources for more accurate and detailed interpretations.

## Features Added

1. **Enhanced search_astrology_info()** - Now automatically searches web sources when local knowledge is insufficient
2. **New search_web_astrology()** - Direct web search for professional astrology information
3. **Improved article fetching** - Better HTML parsing for astrology articles
4. **Reputable source list** - Searches trusted astrology websites

## How It Works

### Automatic Web Search
When `search_astrology_info()` is called:
1. First checks local knowledge base (astrology_rules.js)
2. If not found, automatically searches web for professional sources
3. Returns combined results from local + web sources

### Reputable Astrology Sources
The system searches these trusted astrology websites:
- astrology.com
- cafeastrology.com
- astro.com
- astrostyle.com
- astrologyzone.com
- astro-seek.com
- astrotheme.com
- timeanddate.com/astronomy
- lindagoodman.com
- susanmiller.com

## Setup Options

### Option 1: Google Custom Search API (Recommended for Best Results)

**Pros**: Most accurate, searches reputable sites directly
**Cons**: Requires API key (free tier available)

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable "Custom Search API"
4. Create credentials (API Key)
5. Create a Custom Search Engine at [Google Custom Search](https://cse.google.com/)
6. Add your API key and Search Engine ID to `.env`:

```env
GOOGLE_SEARCH_API_KEY=your_api_key_here
GOOGLE_SEARCH_ENGINE_ID=your_engine_id_here
```

### Option 2: Wikipedia API (Free, No Setup Required)

**Pros**: Free, no API key needed, good for general astrology topics
**Cons**: Limited to Wikipedia content

The system automatically tries Wikipedia API as a fallback. No setup required!

### Option 3: Direct Site Scraping (Future Enhancement)

For production, you could implement direct scraping of specific pages from reputable sites. This would require:
- Respecting robots.txt
- Rate limiting
- Proper error handling

## Current Implementation

The system currently:
- ✅ Uses local knowledge base first
- ✅ Falls back to web search automatically
- ✅ Tries Wikipedia API (free, no key needed)
- ✅ Provides list of reputable sources if search fails
- ✅ Uses Google Custom Search if API keys are configured

## Usage

The AI will automatically use web search when:
- Local knowledge doesn't have the information
- User asks for detailed interpretations
- User asks about complex astrology topics
- User wants professional sources

**Example prompts that trigger web search:**
- "What does Venus in Scorpio mean?" (searches for professional interpretation)
- "Tell me about Saturn returns" (searches for detailed explanation)
- "What is a Yod aspect?" (searches for concept explanation)
- "Explain the 7th house" (searches for house meanings)

## System Prompt Updates

The AI is now instructed to:
- ✅ Use `search_astrology_info()` for MOST questions
- ✅ Prioritize professional sources
- ✅ Provide detailed, accurate interpretations
- ✅ Only use chart data for user-specific questions

## Testing

To test web search functionality:

1. Ask a question that's not in local knowledge base
2. Check server logs for `[EXTERNAL] Web searching for:`
3. Verify results include web sources

**Example test questions:**
- "What is a grand trine?"
- "Tell me about Chiron in astrology"
- "What does a T-square mean?"
- "Explain progressed charts"

## Troubleshooting

### Web search not working?

1. **Check if cheerio is installed:**
   ```bash
   npm list cheerio
   ```
   If not installed: `npm install cheerio`

2. **Check server logs** for errors

3. **Test Wikipedia search** (should work without API keys):
   - Ask about a general astrology topic
   - Should see Wikipedia results

4. **For Google Custom Search:**
   - Verify API keys in `.env`
   - Check API quota/limits
   - Verify Search Engine ID is correct

### Getting limited results?

- Google Custom Search API has a free tier (100 queries/day)
- Wikipedia API is unlimited but content may be limited
- Consider implementing caching for frequently asked questions

## Next Steps

1. **Set up Google Custom Search** (optional but recommended)
2. **Test with various astrology questions**
3. **Monitor API usage** if using Google Custom Search
4. **Consider caching** popular searches to reduce API calls

## Files Modified

- `backend/external_resources.js` - Added web search functions
- `backend/server.js` - Updated system prompt to encourage search usage
- `package.json` - Added cheerio dependency
