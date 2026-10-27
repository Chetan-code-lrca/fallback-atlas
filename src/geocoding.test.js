import { geocodeLocation } from './geocoding';

beforeEach(() => {
  window.localStorage.clear();
  window.FALLBACK_ATLAS_CONFIG = {
    geocoderUrl: 'https://nominatim.openstreetmap.org/search'
  };
});

test('geocodes a worldwide place and caches the result in browser storage', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => [{
      lat: '34.6937',
      lon: '135.5023',
      name: 'Osaka',
      display_name: 'Osaka, Osaka, Japan',
      type: 'city',
      addresstype: 'city',
      address: { city: 'Osaka', state: 'Osaka', country: 'Japan' }
    }]
  });

  const result = await geocodeLocation('Osaka, Japan', fetchMock);
  expect(result).toEqual({
    label: 'Osaka, Japan',
    center: [135.5023, 34.6937],
    zoom: 12
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toContain('q=Osaka%2C%20Japan');
  expect(window.localStorage.getItem('fallback-atlas-geocode-cache-v1')).toContain('Osaka, Japan');

  const cached = await geocodeLocation('Osaka, Japan', fetchMock);
  expect(cached).toEqual(result);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('handles a geocoder that returns no match', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => []
  });

  const result = await geocodeLocation('NoSuchPlace-FA-Example-91245', fetchMock);
  expect(result).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
