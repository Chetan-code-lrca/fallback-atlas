/*
 * Runtime geocoder configuration.
 * The provider endpoint can be switched here without rebuilding the React bundle.
 * A replacement must support the Nominatim-compatible /search response and CORS.
 */
window.FALLBACK_ATLAS_CONFIG = {
  geocoderUrl: 'https://nominatim.openstreetmap.org/search'
};
