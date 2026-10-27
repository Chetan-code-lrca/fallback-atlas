const CACHE_KEY = 'fallback-atlas-geocode-cache-v1';
const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CACHE_MAX_ITEMS = 40;
const MIN_REQUEST_INTERVAL_MS = 1100;
let lastRemoteRequestAt = 0;

function getEndpoint() {
  if (
    typeof window !== 'undefined' &&
    window.FALLBACK_ATLAS_CONFIG &&
    typeof window.FALLBACK_ATLAS_CONFIG.geocoderUrl === 'string' &&
    window.FALLBACK_ATLAS_CONFIG.geocoderUrl.trim()
  ) {
    return window.FALLBACK_ATLAS_CONFIG.geocoderUrl.trim();
  }
  return 'https://nominatim.openstreetmap.org/search';
}

function readCache() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(CACHE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (error) {
    return {};
  }
}

function writeCache(cache) {
  try {
    const entries = Object.entries(cache)
      .sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0))
      .slice(0, CACHE_MAX_ITEMS);
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch (error) {
    // Search still works if browser storage is unavailable or full.
  }
}

function shortLabel(place) {
  const address = place.address || {};
  const firstName = String(place.name || (place.display_name || '').split(',')[0] || '').trim();
  const context = [
    address.city || address.town || address.village || address.municipality ||
      address.county || address.state_district,
    address.state || address.region,
    address.country
  ];
  const parts = [];
  [firstName, ...context].forEach((part) => {
    const value = String(part || '').trim();
    if (value && !parts.some((existing) => existing.toLowerCase() === value.toLowerCase())) parts.push(value);
  });
  if (parts.length < 2 && place.display_name) {
    String(place.display_name).split(',').slice(1, 3).forEach((part) => {
      const value = part.trim();
      if (value && !parts.some((existing) => existing.toLowerCase() === value.toLowerCase())) parts.push(value);
    });
  }
  return parts.slice(0, 3).join(', ') || String(place.display_name || 'Selected location').trim();
}

function suggestedZoom(place) {
  const type = String(place.addresstype || place.type || place.class || '').toLowerCase();
  if (type === 'country') return 5;
  if (type === 'state' || type === 'region') return 7;
  if (type === 'county' || type === 'district') return 9;
  if (['city', 'town', 'village', 'municipality'].includes(type)) return 12;
  if (['suburb', 'quarter', 'neighbourhood', 'neighborhood', 'postcode'].includes(type)) return 14;
  if (['road', 'residential', 'house', 'building'].includes(type)) return 16;
  if (['amenity', 'shop', 'office', 'tourism'].includes(type)) return 15;
  return 12;
}

function toLocation(place) {
  const lat = Number(place.lat);
  const lon = Number(place.lon);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { label: shortLabel(place), center: [lon, lat], zoom: suggestedZoom(place) };
}

function waitForRequestSlot() {
  const now = Date.now();
  const remaining = MIN_REQUEST_INTERVAL_MS - (now - lastRemoteRequestAt);
  if (lastRemoteRequestAt === 0 || remaining <= 0) {
    lastRemoteRequestAt = now;
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    setTimeout(() => {
      lastRemoteRequestAt = Date.now();
      resolve();
    }, remaining);
  });
}

export async function geocodeLocation(query, fetchImpl) {
  const normalized = String(query || '').trim().replace(/\s+/g, ' ');
  if (!normalized) return null;

  const cacheKey = normalized.toLocaleLowerCase();
  const cache = readCache();
  const cached = cache[cacheKey];
  if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS) return cached.location;

  await waitForRequestSlot();
  const params = [
    ['q', normalized],
    ['format', 'jsonv2'],
    ['limit', '1'],
    ['addressdetails', '1'],
    ['namedetails', '1']
  ].map(([key, value]) => encodeURIComponent(key) + '=' + encodeURIComponent(value)).join('&');
  const endpoint = getEndpoint();
  const url = endpoint + (endpoint.includes('?') ? '&' : '?') + params;

  let response;
  try {
    const request = fetchImpl || fetch;
    response = await request(url, {
      headers: { Accept: 'application/json' },
      referrerPolicy: 'strict-origin-when-cross-origin'
    });
  } catch (error) {
    throw new Error('Location search could not connect. Check your internet connection and try again.');
  }

  if (response.status === 429) {
    throw new Error('Location search is busy right now. Please wait a little before trying again.');
  }
  if (!response.ok) {
    throw new Error('Location search is temporarily unavailable (HTTP ' + response.status + '). Please try again later.');
  }

  let results;
  try {
    results = await response.json();
  } catch (error) {
    throw new Error('Location search returned an unreadable response. Please try again.');
  }
  if (!Array.isArray(results) || results.length === 0) return null;

  const location = toLocation(results[0]);
  if (!location) return null;
  cache[cacheKey] = { savedAt: Date.now(), location };
  writeCache(cache);
  return location;
}
