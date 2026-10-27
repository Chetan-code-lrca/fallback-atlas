import React from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
});

test('renders the Fallback Atlas prototype and marks the map as illustrative', () => {
  const { container } = render(<App />);

  expect(container.querySelector('h1').textContent).toContain('works.');
  expect(container.querySelector('.map-footer').textContent).toContain('illustrative examples');
  expect(container.querySelector('.live-map')).toBeTruthy();
});

test('sets an area label and clearly explains that lookup is not connected', () => {
  const { container } = render(<App />);
  const input = container.querySelector('#area-search');

  fireEvent.change(input, { target: { value: '523105' } });
  fireEvent.click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Set area')));

  expect(container.querySelector('.section-heading h2').textContent).toBe('523105');
  expect(container.querySelector('.notice').textContent).toContain('map remains centered on Jaipur');
});

test('saves a report locally and shows it in the feed', () => {
  const { container } = render(<App />);
  const buttons = Array.from(container.querySelectorAll('button'));
  fireEvent.click(buttons.find((button) => button.textContent.includes('Report status')));

  const areaInput = container.querySelector('.report-form input');
  fireEvent.change(areaInput, { target: { value: 'Campus Block A' } });

  const noteInput = container.querySelector('.report-form textarea');
  fireEvent.change(noteInput, { target: { value: 'Testing the local prototype.' } });

  fireEvent.click(Array.from(container.querySelectorAll('button')).find((button) => button.textContent.includes('Save local report')));

  expect(container.querySelector('.notice').textContent).toContain('saved on this device only');
  expect(container.querySelector('.report-feed').textContent).toContain('Campus Block A');
  expect(window.localStorage.getItem('fallback-atlas-local-reports')).toContain('Campus Block A');
});
