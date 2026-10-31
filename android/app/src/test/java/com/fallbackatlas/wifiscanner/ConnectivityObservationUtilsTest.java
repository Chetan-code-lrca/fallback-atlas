package com.fallbackatlas.wifiscanner;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import java.util.Arrays;
import java.util.Collections;

import org.junit.Test;

public class ConnectivityObservationUtilsTest {
    @Test
    public void mapsValidatedInternetToWorking() {
        assertEquals("working", ConnectivityObservationUtils.statusForCapabilities(true, true));
    }

    @Test
    public void mapsUnvalidatedInternetToDegraded() {
        assertEquals("degraded", ConnectivityObservationUtils.statusForCapabilities(true, false));
    }

    @Test
    public void mapsNetworkWithoutInternetToDown() {
        assertEquals("down", ConnectivityObservationUtils.statusForCapabilities(false, false));
    }

    @Test
    public void aggregatesMultipleNetworksByBestAvailableStatus() {
        assertEquals("working", ConnectivityObservationUtils.aggregateStatus(Arrays.asList("down", "working")));
        assertEquals("degraded", ConnectivityObservationUtils.aggregateStatus(Arrays.asList("down", "degraded")));
        assertEquals("down", ConnectivityObservationUtils.aggregateStatus(Collections.singletonList("down")));
        assertEquals("down", ConnectivityObservationUtils.aggregateStatus(Collections.emptyList()));
    }

    @Test
    public void publishesOnStateChangeButThrottlesRepeatedHeartbeats() {
        assertTrue(ConnectivityObservationUtils.shouldPublish(null, "working", 0L, 1L));
        assertTrue(ConnectivityObservationUtils.shouldPublish("working", "down", 100L, 101L));
        assertFalse(ConnectivityObservationUtils.shouldPublish("working", "working", 100L, 101L));
        assertTrue(ConnectivityObservationUtils.shouldPublish(
            "working", "working", 100L,
            100L + ConnectivityObservationUtils.MIN_PUBLISH_INTERVAL_MS
        ));
    }

    @Test
    public void ignoresMissingStatuses() {
        assertFalse(ConnectivityObservationUtils.shouldPublish("working", null, 0L, 1L));
    }
}
