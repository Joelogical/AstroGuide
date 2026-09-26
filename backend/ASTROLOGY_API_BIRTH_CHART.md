# AstrologyAPI.com natal-chart backup

Natal charts now calculate locally with Swiss Ephemeris (`@swisseph/node` in `swisseph_birth_chart.js`).

The original AstrologyAPI.com script was **not deleted**. The working copy lives in:

- [`astrology_api_birth_chart.js`](astrology_api_birth_chart.js)

It still posts to:

- `https://json.astrologyapi.com/v1/planets/tropical`
- `https://json.astrologyapi.com/v1/house_cusps/tropical`

and maps the response into the same `birthChart` object the rest of the app expects.

## When it runs

`/api/birth-chart` tries Swiss Ephemeris first. If that throws, it falls back to this file automatically.

Force the old API:

```
CHART_ENGINE=astrologyapi
```

Needs `ASTROLOGY_API_USER_ID` and `ASTROLOGY_API_KEY` in `backend/.env`.
