import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
  delete window.maplibregl;
  delete window.__MAPLIBRE_LOAD_STATE;
});

afterEach(() => {
  cleanup();
});

function buttonContaining(container, text) {
  return Array.from(container.querySelectorAll('button')).find((button) =>
    button.textContent.includes(text)
  );
}

test('defaults to Udaipur and labels map markers as illustrative', () => {
  const { container } = render(<App />);

  expect(container.querySelector('h1').textContent).toContain('works.');
  expect(container.querySelector('.section-heading h2').textContent).toBe('Udaipur, Rajasthan');
  expect(container.querySelector('.panel-heading h3').textContent).toContain('Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Udaipur, Rajasthan');
  expect(container.querySelector('.map-footer').textContent).toContain('illustrative examples');
});

test('searching a supported Udaipur area recenters the map preset', () => {
  const { container } = render(<App />);
  const input = container.querySelector('#area-search');

  fireEvent.change(input, { target: { value: 'Hiran Magri' } });
  fireEvent.click(buttonContaining(container, 'Set area'));

  expect(container.querySelector('.section-heading h2').textContent).toBe('Hiran Magri, Udaipur');
  expect(container.querySelector('.live-map').getAttribute('aria-label')).toContain('Hiran Magri, Udaipur');
  expect(container.querySelector('.notice').textContent).toContain('illustrative');
});

test('unsupported PIN/address search explains which local presets are available', () => {
  const { container } = render(<App />);
  const input = container.querySelector('#area-search');

  fireEvent.change(input, { target: { value: '313001' } });
  fireEvent.click(buttonContaining(container, 'Set area'));

  expect(container.querySelector('.section-heading h2').textContent).toBe('Udaipur, Rajasthan');
  expect(container.querySelector('.notice').textContent).toContain('Try Udaipur, Fatehpura, Hiran Magri, Pratap Nagar or Udaipur City');
  expect(container.querySelector('.notice').textContent).toContain('No external geocoding API is used');
});

test('report form saves locally and shows the report in the feed', () => {
  const { container } = render(<App />);
  fireEvent.click(buttonContaining(container, 'Report status'));

  const areaInput = container.querySelector('.report-form input:not([type="radio"])');
  fireEvent.change(areaInput, { target: { value: 'Hiran Magri, Udaipur' } });
  fireEvent.change(container.querySelector('.report-form select'), { target: { value: 'Power' } });
  fireEvent.click(container.querySelector('.status-choice input[value="down"]'));
  fireEvent.change(container.querySelector('.report-form textarea'), {
    target: { value: 'Testing the local prototype.' }
  });
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
  expect(feedText).not.toContain('Mobile data');
  expect(feedText).not.toContain('Fixed broadband');
});
