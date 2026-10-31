import { createWifiPopupContent } from './InteractiveMap';

describe('Wi-Fi observation map popup attribution', () => {
  test('identifies Windows observations as Windows-detected', () => {
    const popup = createWifiPopupContent({
      networkName: 'community-network',
      signalType: 'windows-percent-estimate',
      signalPercent: 72,
      signalDbm: -64,
      frequencyMhz: 5180,
      security: 'WPA2',
      area: 'Campus'
    });

    expect(popup.querySelector('small').textContent).toContain('Detected by a Windows device.');
    expect(popup.querySelector('small').textContent).not.toContain('Android');
    expect(popup.textContent).toContain('Windows-reported 72% signal');
  });

  test('identifies Android RSSI observations as Android-detected', () => {
    const popup = createWifiPopupContent({
      networkName: 'community-network',
      signalType: 'android-rssi',
      signalDbm: -61,
      frequencyMhz: 2437,
      security: 'WPA2',
      area: 'Campus'
    });

    expect(popup.querySelector('small').textContent).toContain('Detected by an Android device.');
    expect(popup.querySelector('small').textContent).not.toContain('Windows');
    expect(popup.textContent).toContain('-61 dBm');
  });
});
