package com.fallbackatlas.wifiscanner;

import java.util.Locale;

final class WifiScanUtils {
    static final int MAX_SSID_LENGTH = 32;
    static final long MAX_SHARE_AGE_SECONDS = 120L;

    private WifiScanUtils() {}

    static String visibleSsid(String rawSsid) {
        if (rawSsid == null) return null;
        String ssid = rawSsid.trim();
        if (ssid.isEmpty() || ssid.length() > MAX_SSID_LENGTH) return null;
        return ssid;
    }

    static long ageSeconds(long elapsedRealtimeMicros, long scanTimestampMicros) {
        if (scanTimestampMicros <= 0L) return Long.MAX_VALUE;
        return Math.max(0L, elapsedRealtimeMicros - scanTimestampMicros) / 1_000_000L;
    }

    static String deduplicationKey(String ssid, int frequencyMhz) {
        return ssid.toLowerCase(Locale.ROOT) + "|" + frequencyMhz;
    }

    static boolean isFreshForSharing(long ageSeconds) {
        return ageSeconds >= 0L && ageSeconds <= MAX_SHARE_AGE_SECONDS;
    }

    static String securityLabel(String capabilities) {
        String value = capabilities == null ? "" : capabilities.toUpperCase(Locale.ROOT);
        if (value.contains("SAE")) return "WPA3";
        if (value.contains("EAP")) return "Enterprise";
        if (value.contains("WPA")) return "WPA/WPA2";
        if (value.contains("WEP")) return "WEP";
        return "Open/unknown";
    }

    static String bandLabel(int frequencyMhz) {
        if (frequencyMhz >= 5925) return "6 GHz";
        if (frequencyMhz >= 4900) return "5 GHz";
        return "2.4 GHz";
    }

    static String signalLabel(int rssi) {
        if (rssi >= -55) return "Very good";
        if (rssi >= -67) return "Good";
        if (rssi >= -75) return "Fair";
        return "Weak";
    }

    static String ageLabel(long seconds) {
        if (seconds == Long.MAX_VALUE) return "unknown age";
        if (seconds < 5L) return "just scanned";
        if (seconds < 60L) return seconds + " sec ago";
        return (seconds / 60L) + " min ago";
    }
}
