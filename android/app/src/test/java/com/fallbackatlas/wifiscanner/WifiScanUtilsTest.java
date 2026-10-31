package com.fallbackatlas.wifiscanner;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertNull;
import static org.junit.Assert.assertTrue;

import org.junit.Test;

public class WifiScanUtilsTest {
    @Test
    public void trimsVisibleSsidAndRejectsNullEmptyHiddenAndOverlongNames() {
        assertEquals("campus-guest", WifiScanUtils.visibleSsid("  campus-guest  "));
        assertNull(WifiScanUtils.visibleSsid(null));
        assertNull(WifiScanUtils.visibleSsid("   "));
        assertNull(WifiScanUtils.visibleSsid("x".repeat(33)));
        assertEquals("x".repeat(32), WifiScanUtils.visibleSsid("x".repeat(32)));
    }

    @Test
    public void computesScanAgeAndMarksMissingTimestampsUnknown() {
        assertEquals(30L, WifiScanUtils.ageSeconds(90_000_000L, 60_000_000L));
        assertEquals(0L, WifiScanUtils.ageSeconds(60_000_000L, 90_000_000L));
        assertEquals(Long.MAX_VALUE, WifiScanUtils.ageSeconds(90_000_000L, 0L));
    }

    @Test
    public void treatsOnlyObservationsAtMostTwoMinutesOldAsShareable() {
        assertTrue(WifiScanUtils.isFreshForSharing(0L));
        assertTrue(WifiScanUtils.isFreshForSharing(120L));
        assertFalse(WifiScanUtils.isFreshForSharing(121L));
        assertFalse(WifiScanUtils.isFreshForSharing(Long.MAX_VALUE));
    }

    @Test
    public void deduplicatesSsidFrequencyPairsCaseInsensitively() {
        assertEquals("campus-guest|5180", WifiScanUtils.deduplicationKey("Campus-Guest", 5180));
        assertEquals(WifiScanUtils.deduplicationKey("Campus-Guest", 5180),
            WifiScanUtils.deduplicationKey("campus-guest", 5180));
        assertFalse(WifiScanUtils.deduplicationKey("campus-guest", 5180)
            .equals(WifiScanUtils.deduplicationKey("campus-guest", 5200)));
    }

    @Test
    public void labelsWifiBandsAtTheExistingBoundaries() {
        assertEquals("2.4 GHz", WifiScanUtils.bandLabel(2462));
        assertEquals("5 GHz", WifiScanUtils.bandLabel(5180));
        assertEquals("6 GHz", WifiScanUtils.bandLabel(5975));
    }

    @Test
    public void categorizesRssiAtTheExistingThresholds() {
        assertEquals("Very good", WifiScanUtils.signalLabel(-55));
        assertEquals("Good", WifiScanUtils.signalLabel(-67));
        assertEquals("Fair", WifiScanUtils.signalLabel(-75));
        assertEquals("Weak", WifiScanUtils.signalLabel(-76));
    }

    @Test
    public void prioritizesModernSecurityLabelsAndHandlesUnknownCapabilities() {
        assertEquals("WPA3", WifiScanUtils.securityLabel("[WPA2-PSK-SAE-CCMP]"));
        assertEquals("Enterprise", WifiScanUtils.securityLabel("[WPA2-EAP-CCMP]"));
        assertEquals("WPA/WPA2", WifiScanUtils.securityLabel("[WPA2-PSK-CCMP]"));
        assertEquals("WEP", WifiScanUtils.securityLabel("[WEP]"));
        assertEquals("Open/unknown", WifiScanUtils.securityLabel(null));
    }

    @Test
    public void formatsObservationAgeIncludingUnknownValues() {
        assertEquals("unknown age", WifiScanUtils.ageLabel(Long.MAX_VALUE));
        assertEquals("just scanned", WifiScanUtils.ageLabel(4L));
        assertEquals("5 sec ago", WifiScanUtils.ageLabel(5L));
        assertEquals("1 min ago", WifiScanUtils.ageLabel(60L));
    }
}
