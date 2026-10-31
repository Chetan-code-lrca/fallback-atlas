import React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import ConnectivityStatusPanel from './ConnectivityStatusPanel';

const originalFetch = global.fetch;

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

test('shows the pilot-disabled explanation when connectivity ingestion is off', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      mode: 'pilot-disabled',
      ingestionEnabled: false,
      observations: []
    })
  });

  const { container } = render(
    <ConnectivityStatusPanel area="Udaipur, Rajasthan" refreshToken={0} />
  );
  await act(async () => { await Promise.resolve(); });

  expect(container.textContent).toContain('Automated ingestion is not enabled');
  expect(container.querySelector('.connectivity-status-list')).toBeNull();
});

test('renders recent Android Wi-Fi and mobile-data status without implying official telemetry', async () => {
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({
      mode: 'shared',
      ingestionEnabled: true,
      observations: [
        {
          area: 'SPSU campus, Udaipur',
          service: 'wifi',
          status: 'working',
          internetValidated: true,
          observedAt: new Date().toISOString(),
          source: 'android-connectivity-agent'
        },
        {
          area: 'SPSU campus, Udaipur',
          service: 'mobile-data',
          status: 'degraded',
          internetValidated: false,
          observedAt: new Date().toISOString(),
          source: 'android-connectivity-agent'
        }
      ]
    })
  });

  const { container } = render(
    <ConnectivityStatusPanel area="SPSU campus, Udaipur" refreshToken={0} />
  );
  await act(async () => { await Promise.resolve(); });

  expect(container.textContent).toContain('Wi-Fi internet');
  expect(container.textContent).toContain('Mobile data internet');
  expect(container.textContent).toContain('Internet validated');
  expect(container.textContent).toContain('Degraded');
  expect(container.textContent).toContain('not official provider measurements');
});
