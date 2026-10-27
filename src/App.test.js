import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { act } from 'react-dom/test-utils';
import App from './App';
import { geocodeLocation } from './geocoding';

jest.mock('./geocoding', () => ({
  geocodeLocation: jest.fn()
}));

const originalFetch = global.fetch;

beforeEach(() => {
  window.localStorage.clear();
  delete window.maplibregl;
  delete window.__MAPLIBRE_LOAD_STATE;
  window.FALLBACK_ATLAS_CONFIG = { geocoderUrl: 'https://nominatim.openstreetmap.org/search' };
  geocodeLocation.mockReset();
  global.fetch = jest.fn((url, options) => {
    if (url === '/api/health') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok', mode: 'local' }) });
    }
    if (options && options.method === 'POST') {
      return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: 'storage_not_configured' }) });
    }
    return Promise.resolve({ ok: false, status: 503, json: async () => ({ error: 'storage_not_configured' }) });
  });
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

test('defaults to Udaipur and labels demo markers clearly', () => {
  const { container } = render(<App />);
  expect(container.querySelector('h1').textContent).toContain('works.');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Udaipur, Rajasthan');
  expect(container.querySelector('.panel-heading h3').textContent).toContain('Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Udaipur, Rajasthan');
  expect(container.querySelector('.live-map-shell').getAttribute('data-show-demo-markers')).toBe('true');
  expect(container.querySelector('.map-footer').textContent).toContain('not verified live reports');
});

test('searching a supported Udaipur area uses a local preset without geocoding', () => {
  const { container } = render(<App />);
  submitLocation(container, 'Hiran Magri');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Hiran Magri, Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Hiran Magri, Udaipur');
  expect(container.querySelector('.notice').textContent).toContain('illustrative');
  expect(geocodeLocation).not.toHaveBeenCalled();
});

test('searching a worldwide location recenters the map and hides Udaipur demo markers', async () => {
  geocodeLocation.mockResolvedValue({
    label: 'Osaka, Japan',
    center: [135.5023, 34.6937],
    zoom: 12
  });

  const { container } = render(<App />);
  submitLocation(container, 'Osaka, Japan');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });

  expect(geocodeLocation).toHaveBeenCalledWith('Osaka, Japan');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Osaka, Japan');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Osaka, Japan');
  expect(container.querySelector('.live-map-shell').getAttribute('data-show-demo-markers')).toBe('false');
  expect(container.querySelector('.notice').textContent).toContain('No verified outage reports');
});

test('reports are saved locally and marked pending when shared storage is not configured', async () => {
  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));
  fireEvent.change(container.querySelector('.report-form input:not([type="radio"])'), {
    target: { value: 'Hiran Magri, Udaipur' }
  });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="down"]'));
  fireEvent.change(container.querySelector('.report-form textarea'), {
    target: { value: 'Testing the local prototype.' }
  });
  await act(async () => {
    fireEvent.click(buttonContaining(container, 'Submit report'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  expect(container.querySelector('.notice').textContent).toContain('pending sync');
  expect(container.querySelector('.report-feed').textContent).toContain('Hiran Magri, Udaipur');
  expect(container.querySelector('.report-feed').textContent).toContain('Power');
  expect(container.querySelector('.report-feed').textContent).toContain('Down');
  expect(window.localStorage.getItem('fallback-atlas-local-reports')).toContain('Hiran Magri, Udaipur');
  expect(window.localStorage.getItem('fallback-atlas-local-reports')).toContain('pending');
});

test('successful API submission becomes a shared report with freshness metadata', async () => {
  global.fetch.mockImplementation((url, options) => {
    if (url === '/api/health') {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ status: 'ok', mode: 'shared' }) });
    }
    if (options && options.method === 'POST') {
      return Promise.resolve({
        ok: true,
        status: 201,
        json: async () => ({
          mode: 'shared',
          report: {
            id: 'shared-123',
            area: 'Udaipur, Rajasthan',
            service: 'Power',
            status: 'working',
            note: 'Power restored near campus.',
            createdAt: new Date().toISOString(),
            observedAt: new Date().toISOString(),
            shared: true
          }
        })
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ mode: 'shared', reports: [] }) });
  });

  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));
  fireEvent.change(container.querySelector('.report-form input:not([type="radio"])'), {
    target: { value: 'Udaipur, Rajasthan' }
  });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="working"]'));
  fireEvent.change(container.querySelector('.report-form textarea'), {
    target: { value: 'Power restored near campus.' }
  });

  await act(async () => {
    fireEvent.click(buttonContaining(container, 'Submit report'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  expect(container.querySelector('.notice').textContent).toContain('Report shared with other visitors');
  expect(container.querySelector('.report-feed').textContent).toContain('Power restored near campus.');
  expect(container.querySelector('.api-status-banner').textContent).toContain('Shared reporting is online');
  expect(window.localStorage.getItem('fallback-atlas-local-reports')).not.toContain('shared-123');
});

test('service filters only show reports from the selected category', async () => {
  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));
  fireEvent.change(container.querySelector('.report-form input:not([type="radio"])'), {
    target: { value: 'Fatehpura, Udaipur' }
  });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="working"]'));
  await act(async () => {
    fireEvent.click(buttonContaining(container, 'Submit report'));
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  fireEvent.click(buttonContaining(container, 'Power'));
  const feedText = container.querySelector('.report-feed').textContent;
  expect(feedText).toContain('Power');
  expect(feedText).not.toContain('Fixed broadband');
});
