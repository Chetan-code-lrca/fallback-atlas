import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import App from './App';

const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  delete window.maplibregl;
  delete window.__MAPLIBRE_LOAD_STATE;
  window.FALLBACK_ATLAS_CONFIG = { geocoderUrl: 'https://nominatim.openstreetmap.org/search' };
  global.fetch = jest.fn();
  window.fetch = global.fetch;
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  window.fetch = originalFetch;
});

function buttonContaining(container, text) {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent.includes(text)
  );
}

function submitLocation(container, value) {
  fireEvent.change(container.querySelector('#area-search'), { target: { value } });
  fireEvent.click(buttonContaining(container, 'Find location'));
}

async function submitLocationAndWait(container, value) {
  await act(async () => {
    submitLocation(container, value);
    // The submit handler awaits two promises (fetch and response.json) before updating React state.
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
}

test('defaults to Udaipur and labels demo markers clearly', () => {
  const { container } = render(<App />);
  expect(container.querySelector('h1').textContent).toContain('works.');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Udaipur, Rajasthan');
  expect(container.querySelector('.panel-heading h3').textContent).toContain('Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Udaipur, Rajasthan');
  expect(container.querySelector('.live-map-shell').getAttribute('data-show-demo-markers')).toBe('true');
  expect(container.querySelector('.map-footer').textContent).toContain('not verified live reports');
});

test('searching a supported Udaipur area recenters the local preset without calling a geocoder', () => {
  const { container } = render(<App />);
  submitLocation(container, 'Hiran Magri');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Hiran Magri, Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Hiran Magri, Udaipur');
  expect(container.querySelector('.notice').textContent).toContain('illustrative');
  expect(global.fetch).not.toHaveBeenCalled();
});

test('searching a worldwide location recenters the map and hides Udaipur demo markers', async () => {
  global.fetch.mockResolvedValue({
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

  const { container } = render(<App />);
  await submitLocationAndWait(container, 'Osaka, Japan');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(container.querySelector('.section-heading h2').textContent).toBe('Osaka, Japan');

  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Osaka, Japan');
  expect(container.querySelector('.live-map-shell').getAttribute('data-show-demo-markers')).toBe('false');
  expect(container.querySelector('.notice').textContent).toContain('No verified outage reports');
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect(global.fetch.mock.calls[0][0]).toContain('q=Osaka%2C%20Japan');

  // Submitting the same location again should use the browser cache.
  await submitLocationAndWait(container, 'Osaka, Japan');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Osaka, Japan');
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

test('reports are saved locally and shown in the current area feed', () => {
  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));
  fireEvent.change(container.querySelector('.report-form input:not([type="radio"])'), {
    target: { value: 'Hiran Magri, Udaipur' }
  });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="down"]'));
  fireEvent.change(container.querySelector('.report-form textarea'), { target: { value: 'Testing the local prototype.' } });
  fireEvent.click(buttonContaining(container, 'Save local report'));
  expect(container.querySelector('.notice').textContent).toContain('saved on this device only');
  expect(container.querySelector('.report-feed').textContent).toContain('Hiran Magri, Udaipur');
  expect(container.querySelector('.report-feed').textContent).toContain('Power');
  expect(container.querySelector('.report-feed').textContent).toContain('Down');
  expect(window.localStorage.getItem('fallback-atlas-local-reports')).toContain('Hiran Magri, Udaipur');
});

test('service filters only show reports from the selected category', () => {
  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));
  fireEvent.change(container.querySelector('.report-form input:not([type="radio"])'), {
    target: { value: 'Fatehpura, Udaipur' }
  });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="working"]'));
  fireEvent.click(buttonContaining(container, 'Save local report'));
  fireEvent.click(buttonContaining(container, 'Power'));
  const feedText = container.querySelector('.report-feed').textContent;
  expect(feedText).toContain('Power');
  expect(feedText).not.toContain('Fixed broadband');
});
