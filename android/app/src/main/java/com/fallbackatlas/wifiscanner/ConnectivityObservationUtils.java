package com.fallbackatlas.wifiscanner;

import java.util.Collection;

final class ConnectivityObservationUtils {
    static final long MIN_PUBLISH_INTERVAL_MS = 5 * 60 * 1000L;

    private ConnectivityObservationUtils() {}

    static String statusForCapabilities(boolean hasInternet, boolean validated) {
        if (!hasInternet) return "down";
        return validated ? "working" : "degraded";
    }

    static String aggregateStatus(Collection<String> statuses) {
        if (statuses == null || statuses.isEmpty()) return "down";
        boolean degraded = false;
        for (String status : statuses) {
            if ("working".equals(status)) return "working";
            if ("degraded".equals(status)) degraded = true;
        }
        return degraded ? "degraded" : "down";
    }

    static boolean shouldPublish(String previousStatus, String nextStatus,
                                 long lastPublishedAtMs, long nowMs) {
        if (nextStatus == null) return false;
        if (previousStatus == null || !previousStatus.equals(nextStatus)) return true;
        return nowMs - lastPublishedAtMs >= MIN_PUBLISH_INTERVAL_MS;
    }
}
