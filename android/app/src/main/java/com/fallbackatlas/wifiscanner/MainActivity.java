package com.fallbackatlas.wifiscanner;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.PackageManager;
import android.content.SharedPreferences;
import android.text.InputFilter;
import android.location.Location;
import android.location.LocationManager;
import android.net.wifi.ScanResult;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Bundle;
import android.os.CancellationSignal;
import android.os.SystemClock;
import android.provider.Settings;
import android.graphics.Color;
import android.graphics.Typeface;
import android.view.Gravity;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private static final int REQUEST_WIFI_PERMISSIONS = 4101;
    private static final String API_URL =
        "https://ambitious-smoke-035c3f900.6.azurestaticapps.net/api/wifi-scans";
    private static final String CONNECTIVITY_API_URL =
        "https://ambitious-smoke-035c3f900.6.azurestaticapps.net/api/connectivity-observations";
    private static final String PREFS_NAME = "fallback-atlas-connectivity";
    private static final String PREF_MONITOR_ENABLED = "monitor_enabled";
    private static final String PREF_PENDING_PREFIX = "pending_";

    private WifiManager wifiManager;
    private LocationManager locationManager;
    private LinearLayout root;
    private LinearLayout resultList;
    private TextView statusView;
    private TextView countView;
    private Button scanButton;
    private Button shareButton;
    private Button monitorButton;
    private TextView monitorStatusView;
    private EditText areaInput;
    private SharedPreferences preferences;
    private ConnectivityMonitor connectivityMonitor;
    private final Map<String, String> lastPublishedStatus = new HashMap<>();
    private final Map<String, Long> lastPublishedAt = new HashMap<>();
    private long lastConnectivityUploadAttemptAt = 0L;
    private boolean activityVisible = false;
    private final ExecutorService ioExecutor = Executors.newSingleThreadExecutor();
    private final List<NetworkObservation> observations = new ArrayList<>();
    private boolean receiverRegistered = false;
    private boolean lastScanWasFresh = false;

    private final BroadcastReceiver scanReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            if (!WifiManager.SCAN_RESULTS_AVAILABLE_ACTION.equals(intent.getAction())) return;
            boolean updated = intent.getBooleanExtra(WifiManager.EXTRA_RESULTS_UPDATED, false);
            if (!updated) {
                lastScanWasFresh = false;
                shareButton.setEnabled(false);
                setStatus("Android did not refresh the scan. It may have throttled the request; old results will not be uploaded.");
                return;
            }
            showScanResults();
        }
    };

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        wifiManager = (WifiManager) getApplicationContext().getSystemService(WIFI_SERVICE);
        locationManager = (LocationManager) getSystemService(LOCATION_SERVICE);
        preferences = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        connectivityMonitor = new ConnectivityMonitor(this, new ConnectivityMonitor.Listener() {
            @Override
            public void onObservation(String service, String status, boolean internetValidated) {
                runOnUiThread(() -> handleConnectivityObservation(service, status, internetValidated));
            }

            @Override
            public void onMonitorError(String message) {
                runOnUiThread(() -> setMonitorStatus(message));
            }
        });
        setContentView(buildUi());
        updateMonitorButton();
        renderNetworkRows();
        setStatus("Ready. Allow nearby Wi-Fi/location permission, then scan to see networks the phone actually detects.");
    }

    @Override
    protected void onStart() {
        super.onStart();
        activityVisible = true;
        if (receiverRegistered) return;
        IntentFilter filter = new IntentFilter(WifiManager.SCAN_RESULTS_AVAILABLE_ACTION);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(scanReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(scanReceiver, filter);
        }
        receiverRegistered = true;
        if (preferences != null && preferences.getBoolean(PREF_MONITOR_ENABLED, false)) {
            startConnectivityMonitoring();
        }
    }

    @Override
    protected void onStop() {
        activityVisible = false;
        if (connectivityMonitor != null) connectivityMonitor.stop();
        if (preferences != null && preferences.getBoolean(PREF_MONITOR_ENABLED, false)) {
            setMonitorStatus("Monitoring pauses when this app is not visible. Reopen it to continue monitoring and sync pending status.");
        }
        if (receiverRegistered) {
            unregisterReceiver(scanReceiver);
            receiverRegistered = false;
        }
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        if (connectivityMonitor != null) connectivityMonitor.stop();
        ioExecutor.shutdownNow();
        super.onDestroy();
    }

    private View buildUi() {
        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(dp(20), dp(24), dp(20), dp(30));
        root.setBackgroundColor(Color.rgb(244, 247, 250));
        scroll.addView(root);

        TextView brand = text("FALLBACK ATLAS", 13, Color.rgb(8, 126, 128), true);
        brand.setLetterSpacing(0.12f);
        root.addView(brand);

        TextView title = text("Nearby Wi-Fi networks", 28, Color.rgb(18, 40, 58), true);
        LinearLayout.LayoutParams titleParams = params(-1, -2);
        titleParams.topMargin = dp(8);
        root.addView(title, titleParams);

        TextView intro = text(
            "Real scan results from this Android phone — not guessed network names.",
            15, Color.rgb(82, 101, 119), false);
        LinearLayout.LayoutParams introParams = params(-1, -2);
        introParams.topMargin = dp(8);
        root.addView(intro, introParams);

        TextView privacy = text(
            "This app never asks for or reads Wi-Fi passwords. It does not upload access-point MAC addresses or a device identifier.",
            13, Color.rgb(82, 101, 119), false);
        privacy.setPadding(dp(12), dp(12), dp(12), dp(12));
        privacy.setBackgroundColor(Color.rgb(231, 243, 241));
        LinearLayout.LayoutParams privacyParams = params(-1, -2);
        privacyParams.topMargin = dp(16);
        root.addView(privacy, privacyParams);

        TextView areaLabel = text("Area label for the shared map", 14, Color.rgb(24, 42, 59), true);
        LinearLayout.LayoutParams labelParams = params(-1, -2);
        labelParams.topMargin = dp(20);
        root.addView(areaLabel, labelParams);

        areaInput = new EditText(this);
        areaInput.setSingleLine(true);
        areaInput.setFilters(new InputFilter[] { new InputFilter.LengthFilter(120) });
        areaInput.setText("SPSU campus, Udaipur");
        areaInput.setHint("e.g. campus building or public place");
        areaInput.setTextSize(15);
        areaInput.setPadding(dp(12), dp(11), dp(12), dp(11));
        areaInput.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams areaParams = params(-1, -2);
        areaParams.topMargin = dp(7);
        root.addView(areaInput, areaParams);

        TextView monitorHeading = text("Automatic connectivity sharing", 16, Color.rgb(24, 42, 59), true);
        LinearLayout.LayoutParams monitorHeadingParams = params(-1, -2);
        monitorHeadingParams.topMargin = dp(18);
        root.addView(monitorHeading, monitorHeadingParams);

        TextView monitorDisclosure = text(
            "Optional. While this app is open, Fallback Atlas can observe whether Wi-Fi or mobile data has validated internet access. It shares only the selected area, connection type, status and timestamp. No GPS, SSID, access-point MAC address, phone number or device ID is sent.",
            12, Color.rgb(82, 101, 119), false);
        LinearLayout.LayoutParams monitorDisclosureParams = params(-1, -2);
        monitorDisclosureParams.topMargin = dp(6);
        root.addView(monitorDisclosure, monitorDisclosureParams);

        monitorButton = button("Enable automatic monitoring");
        LinearLayout.LayoutParams monitorButtonParams = params(-1, -2);
        monitorButtonParams.topMargin = dp(10);
        root.addView(monitorButton, monitorButtonParams);
        monitorButton.setOnClickListener(view -> toggleConnectivityMonitoring());

        monitorStatusView = text("Automatic monitoring is off.", 12, Color.rgb(82, 101, 119), false);
        LinearLayout.LayoutParams monitorStatusParams = params(-1, -2);
        monitorStatusParams.topMargin = dp(6);
        root.addView(monitorStatusView, monitorStatusParams);

        scanButton = button("Scan nearby Wi-Fi");
        LinearLayout.LayoutParams scanParams = params(-1, -2);
        scanParams.topMargin = dp(15);
        root.addView(scanButton, scanParams);
        scanButton.setOnClickListener(view -> beginScan());

        countView = text("No scan results yet", 14, Color.rgb(82, 101, 119), true);
        LinearLayout.LayoutParams countParams = params(-1, -2);
        countParams.topMargin = dp(22);
        root.addView(countView, countParams);

        resultList = new LinearLayout(this);
        resultList.setOrientation(LinearLayout.VERTICAL);
        LinearLayout.LayoutParams resultsParams = params(-1, -2);
        resultsParams.topMargin = dp(10);
        root.addView(resultList, resultsParams);

        statusView = text("", 13, Color.rgb(82, 101, 119), false);
        statusView.setPadding(dp(12), dp(12), dp(12), dp(12));
        statusView.setBackgroundColor(Color.WHITE);
        LinearLayout.LayoutParams statusParams = params(-1, -2);
        statusParams.topMargin = dp(14);
        root.addView(statusView, statusParams);

        shareButton = button("Share this scan with Fallback Atlas");
        shareButton.setEnabled(false);
        LinearLayout.LayoutParams shareParams = params(-1, -2);
        shareParams.topMargin = dp(14);
        root.addView(shareButton, shareParams);
        shareButton.setOnClickListener(view -> confirmShare());

        TextView limitations = text(
            "Signal level shows how strongly your phone hears an access point. It does not prove that network has working internet. Android may limit how often scans can run. Shared observations are visible to other users and appear in the website's nearby view for 15 minutes.",
            12, Color.rgb(101, 117, 135), false);
        limitations.setPadding(0, dp(18), 0, 0);
        root.addView(limitations);
        return scroll;
    }

    private void beginScan() {
        if (!hasPermissions()) {
            requestPermissions(requiredPermissions(), REQUEST_WIFI_PERMISSIONS);
            return;
        }
        if (locationManager == null || !locationManager.isLocationEnabled()) {
            new AlertDialog.Builder(this)
                .setTitle("Turn on Location")
                .setMessage("Android requires Location services to be enabled before an app can obtain fresh Wi-Fi scan results. Fallback Atlas does not continuously track your location.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Open settings", (dialog, which) ->
                    startActivity(new Intent(Settings.ACTION_LOCATION_SOURCE_SETTINGS)))
                .show();
            return;
        }
        if (wifiManager == null || !wifiManager.isWifiEnabled()) {
            new AlertDialog.Builder(this)
                .setTitle("Turn on Wi-Fi")
                .setMessage("Enable Wi-Fi in Android settings, then return and scan again. Fallback Atlas will not connect to networks for you.")
                .setNegativeButton("Cancel", null)
                .setPositiveButton("Wi-Fi settings", (dialog, which) ->
                    startActivity(new Intent(Settings.ACTION_WIFI_SETTINGS)))
                .show();
            return;
        }
        try {
            shareButton.setEnabled(false);
            lastScanWasFresh = false;
            setStatus("Requesting a fresh scan from Android…");
            boolean started = wifiManager.startScan();
            if (!started) {
                setStatus("Android declined the scan request. This can happen because of scan throttling. Wait a little and try again; cached results will not be shared.");
            }
        } catch (SecurityException error) {
            setStatus("Android denied Wi-Fi scan access. Check the app permissions in Settings.");
        }
    }

    private String[] requiredPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            return new String[] {
                Manifest.permission.ACCESS_FINE_LOCATION,
                Manifest.permission.ACCESS_COARSE_LOCATION,
                Manifest.permission.NEARBY_WIFI_DEVICES
            };
        }
        return new String[] {
            Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION
        };
    }

    private boolean hasPermissions() {
        boolean fineLocation = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED;
        boolean nearbyWifi = Build.VERSION.SDK_INT < 33 ||
            checkSelfPermission(Manifest.permission.NEARBY_WIFI_DEVICES) == PackageManager.PERMISSION_GRANTED;
        return fineLocation && nearbyWifi;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQUEST_WIFI_PERMISSIONS) return;
        if (hasPermissions()) beginScan();
        else setStatus("Wi-Fi scanning needs the runtime permissions requested by Android. Without them this app cannot discover nearby networks.");
    }

    @SuppressLint("MissingPermission")
    private void showScanResults() {
        List<ScanResult> scanResults;
        try {
            scanResults = wifiManager.getScanResults();
        } catch (SecurityException error) {
            lastScanWasFresh = false;
            setStatus("Android denied access to the scan results. Check app permissions.");
            return;
        }

        long elapsedMicros = SystemClock.elapsedRealtimeNanos() / 1000L;
        long nowMillis = System.currentTimeMillis();
        Map<String, NetworkObservation> unique = new HashMap<>();
        for (ScanResult item : scanResults) {
            String ssid = WifiScanUtils.visibleSsid(item.SSID);
            if (ssid == null) continue;
            long ageSeconds = WifiScanUtils.ageSeconds(elapsedMicros, item.timestamp);
            String key = WifiScanUtils.deduplicationKey(ssid, item.frequency);
            NetworkObservation observation = new NetworkObservation(
                ssid, item.level, item.frequency, WifiScanUtils.securityLabel(item.capabilities),
                ageSeconds == Long.MAX_VALUE ? 0L : nowMillis - ageSeconds * 1000L,
                ageSeconds
            );
            NetworkObservation old = unique.get(key);
            if (old == null || observation.signalDbm > old.signalDbm) unique.put(key, observation);
        }

        observations.clear();
        observations.addAll(unique.values());
        observations.sort(Comparator.comparingInt((NetworkObservation item) -> item.signalDbm).reversed());
        lastScanWasFresh = !observations.isEmpty() && observations.stream().allMatch(item -> WifiScanUtils.isFreshForSharing(item.ageSeconds));
        shareButton.setEnabled(lastScanWasFresh);
        renderNetworkRows();

        if (observations.isEmpty()) {
            setStatus("Android returned no visible network names. Hidden SSIDs are intentionally omitted. Check Wi-Fi/Location settings or try again later.");
        } else if (!lastScanWasFresh) {
            setStatus("Android returned results, but some appear older than two minutes. You can view them locally, but must run a fresh scan before sharing.");
        } else {
            setStatus("Fresh device scan complete. These are nearby access points detected by Android; internet availability has not been tested.");
        }
    }

    private void renderNetworkRows() {
        if (resultList == null) return;
        resultList.removeAllViews();
        if (observations.isEmpty()) {
            TextView empty = text("Scan to see the real network names and signal levels your phone can detect.", 14, Color.rgb(101, 117, 135), false);
            empty.setPadding(dp(14), dp(14), dp(14), dp(14));
            empty.setBackgroundColor(Color.WHITE);
            resultList.addView(empty);
            if (countView != null) countView.setText("No scan results yet");
            if (shareButton != null) shareButton.setEnabled(false);
            return;
        }
        countView.setText(observations.size() + " visible network entries · strongest first");
        for (NetworkObservation item : observations) {
            LinearLayout card = new LinearLayout(this);
            card.setOrientation(LinearLayout.VERTICAL);
            card.setPadding(dp(14), dp(12), dp(14), dp(12));
            card.setBackgroundColor(Color.WHITE);
            LinearLayout.LayoutParams cardParams = params(-1, -2);
            cardParams.bottomMargin = dp(8);
            resultList.addView(card, cardParams);

            TextView name = text(item.networkName, 17, Color.rgb(18, 40, 58), true);
            card.addView(name);
            String detail = String.format(Locale.ROOT, "%d dBm  ·  %s  ·  %s", item.signalDbm, WifiScanUtils.bandLabel(item.frequencyMhz), item.security);
            TextView details = text(detail, 13, Color.rgb(82, 101, 119), false);
            LinearLayout.LayoutParams detailParams = params(-1, -2);
            detailParams.topMargin = dp(4);
            card.addView(details, detailParams);
            TextView strength = text(WifiScanUtils.signalLabel(item.signalDbm) + " signal  ·  " + WifiScanUtils.ageLabel(item.ageSeconds), 12,
                WifiScanUtils.isFreshForSharing(item.ageSeconds) ? Color.rgb(8, 126, 128) : Color.rgb(183, 122, 25), true);
            LinearLayout.LayoutParams strengthParams = params(-1, -2);
            strengthParams.topMargin = dp(6);
            card.addView(strength, strengthParams);
        }
        if (shareButton != null) shareButton.setEnabled(lastScanWasFresh);
    }

    private void confirmShare() {
        if (!lastScanWasFresh || observations.isEmpty()) {
            Toast.makeText(this, "Run a fresh scan before sharing.", Toast.LENGTH_LONG).show();
            return;
        }
        String area = areaInput.getText().toString().trim();
        if (area.isEmpty()) {
            areaInput.setError("Enter a public area or campus label");
            return;
        }
        new AlertDialog.Builder(this)
            .setTitle("Share nearby scan observations?")
            .setMessage(
                "This shares visible Wi-Fi names (SSIDs), signal levels, frequency bands, security labels, scan times, your area label and an approximate location rounded to roughly 100 metres. Other Fallback Atlas users may see these observations for 15 minutes. No passwords, access-point MAC addresses, device identifiers or location history will be sent. Signal does not prove internet access. Continue?"
            )
            .setNegativeButton("Cancel", null)
            .setPositiveButton("Share scan", (dialog, which) -> obtainLocationAndUpload(area))
            .show();
    }

    @SuppressLint("MissingPermission")
    private void obtainLocationAndUpload(String area) {
        if (!hasPermissions()) {
            setStatus("Location/Wi-Fi permissions are needed for a map observation.");
            return;
        }
        if (locationManager == null || !locationManager.isLocationEnabled()) {
            setStatus("Turn on Location and try sharing again. Scan results stay on this phone.");
            return;
        }
        setStatus("Getting a one-time approximate location for the scan…");
        getLocationFromProvider(LocationManager.NETWORK_PROVIDER, area, false);
    }

    @SuppressLint("MissingPermission")
    private void getLocationFromProvider(String provider, String area, boolean triedGps) {
        if (locationManager == null) return;
        if (!locationManager.isProviderEnabled(provider)) {
            if (!triedGps) getLocationFromProvider(LocationManager.GPS_PROVIDER, area, true);
            else setStatus("Android could not provide a current location. Scan results stay on the phone.");
            return;
        }
        try {
            locationManager.getCurrentLocation(provider, new CancellationSignal(), getMainExecutor(), location -> {
                if (location != null && System.currentTimeMillis() - location.getTime() < 120_000L) {
                    uploadScan(area, location);
                } else if (!triedGps) {
                    getLocationFromProvider(LocationManager.GPS_PROVIDER, area, true);
                } else {
                    setStatus("No recent location fix was available. Scan results stay on the phone.");
                }
            });
        } catch (SecurityException error) {
            setStatus("Location permission was denied; nothing was uploaded.");
        } catch (RuntimeException error) {
            if (!triedGps) getLocationFromProvider(LocationManager.GPS_PROVIDER, area, true);
            else setStatus("Location lookup failed. Nothing was uploaded.");
        }
    }

    private void uploadScan(String area, Location location) {
        JSONArray networks = new JSONArray();
        for (NetworkObservation item : observations) {
            if (!WifiScanUtils.isFreshForSharing(item.ageSeconds)) continue;
            JSONObject network = new JSONObject();
            try {
                network.put("networkName", item.networkName);
                network.put("signalDbm", item.signalDbm);
                network.put("frequencyMhz", item.frequencyMhz);
                network.put("security", item.security);
                network.put("observedAt", Instant.ofEpochMilli(item.observedAtMillis).toString());
                networks.put(network);
            } catch (Exception ignored) {
                // Omit invalid local row. No credentials or BSSID are read.
            }
        }
        if (networks.length() == 0) {
            setStatus("No recent scan rows remain. Run another scan before sharing.");
            return;
        }

        JSONObject body = new JSONObject();
        try {
            body.put("area", area);
            body.put("latitude", location.getLatitude());
            body.put("longitude", location.getLongitude());
            body.put("networks", networks);
        } catch (Exception error) {
            setStatus("The scan could not be prepared for upload.");
            return;
        }

        shareButton.setEnabled(false);
        setStatus("Sharing " + networks.length() + " nearby observations with Azure…");
        ioExecutor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection) new URL(API_URL).openConnection();
                connection.setRequestMethod("POST");
                connection.setConnectTimeout(10_000);
                connection.setReadTimeout(10_000);
                connection.setDoOutput(true);
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                connection.setRequestProperty("Accept", "application/json");
                byte[] payload = body.toString().getBytes(StandardCharsets.UTF_8);
                connection.setFixedLengthStreamingMode(payload.length);
                try (OutputStream output = connection.getOutputStream()) {
                    output.write(payload);
                }
                int code = connection.getResponseCode();
                InputStream stream = code >= 200 && code < 400 ? connection.getInputStream() : connection.getErrorStream();
                String responseBody = readAll(stream);
                JSONObject response = new JSONObject(responseBody.isEmpty() ? "{}" : responseBody);
                String message = response.optString("message", "");
                runOnUiThread(() -> {
                    if (code == 201) {
                        setStatus("Shared " + response.optInt("accepted", networks.length()) +
                            " real scan observations. The website shows nearby observations, not guaranteed internet availability.");
                    } else if ("storage_not_configured".equals(response.optString("error"))) {
                        setStatus("Azure shared scan storage is not configured yet. Nothing was uploaded; your scan remains on this phone.");
                    } else {
                        setStatus("Scan was not shared (HTTP " + code + "). " + message);
                    }
                    shareButton.setEnabled(lastScanWasFresh);
                });
            } catch (Exception error) {
                runOnUiThread(() -> {
                    setStatus("Could not reach Azure. Nothing was shared; keep this screen open and try again later.");
                    shareButton.setEnabled(lastScanWasFresh);
                });
            } finally {
                if (connection != null) connection.disconnect();
            }
        });
    }


    private void toggleConnectivityMonitoring() {
        boolean enabled = preferences.getBoolean(PREF_MONITOR_ENABLED, false);
        if (enabled) {
            new AlertDialog.Builder(this)
                .setTitle("Stop automatic monitoring?")
                .setMessage("Monitoring stops immediately. Pending observations that have not been uploaded will be removed from this phone.")
                .setNegativeButton("Keep monitoring", null)
                .setPositiveButton("Stop and clear pending", (dialog, which) -> {
                    preferences.edit()
                        .putBoolean(PREF_MONITOR_ENABLED, false)
                        .remove(PREF_PENDING_PREFIX + "wifi")
                        .remove(PREF_PENDING_PREFIX + "mobile-data")
                        .apply();
                    if (connectivityMonitor != null) connectivityMonitor.stop();
                    lastPublishedStatus.clear();
                    lastPublishedAt.clear();
                    updateMonitorButton();
                    setMonitorStatus("Automatic monitoring is off. Pending uploads were cleared.");
                })
                .show();
            return;
        }

        String area = areaInput.getText().toString().trim();
        if (area.isEmpty() || area.length() > 120) {
            areaInput.setError("Enter a public area label (up to 120 characters)");
            return;
        }

        new AlertDialog.Builder(this)
            .setTitle("Enable automatic connectivity sharing?")
            .setMessage(
                "While this app is open, Android will report whether Wi-Fi and mobile data have internet access. " +
                "Only the area label, connection type, status (working/degraded/down), validation result and timestamp are sent. " +
                "No GPS coordinates, SSIDs, passwords, access-point MAC addresses, phone numbers or device IDs are sent. " +
                "Observations may be visible to other visitors and are labelled as Android device observations. " +
                "Uploads are queued locally when offline. Monitoring pauses when you leave this app."
            )
            .setNegativeButton("Not now", null)
            .setPositiveButton("Enable", (dialog, which) -> {
                preferences.edit().putBoolean(PREF_MONITOR_ENABLED, true).apply();
                updateMonitorButton();
                startConnectivityMonitoring();
            })
            .show();
    }

    private void updateMonitorButton() {
        if (monitorButton == null || preferences == null) return;
        boolean enabled = preferences.getBoolean(PREF_MONITOR_ENABLED, false);
        monitorButton.setText(enabled ? "Stop automatic monitoring" : "Enable automatic monitoring");
        if (!enabled && monitorStatusView != null) {
            monitorStatusView.setText("Automatic monitoring is off.");
        }
    }

    private void startConnectivityMonitoring() {
        if (!activityVisible || preferences == null ||
            !preferences.getBoolean(PREF_MONITOR_ENABLED, false) ||
            connectivityMonitor == null) return;
        boolean started = connectivityMonitor.start();
        updateMonitorButton();
        if (started) {
            setMonitorStatus("Monitoring Wi-Fi and mobile data while this app is visible. Status changes are queued and uploaded when a validated connection is available.");
        }
    }

    private void setMonitorStatus(String message) {
        if (monitorStatusView != null) monitorStatusView.setText(message);
    }

    private void handleConnectivityObservation(String service, String status, boolean internetValidated) {
        if (preferences == null || !preferences.getBoolean(PREF_MONITOR_ENABLED, false) || !activityVisible) return;
        String area = areaInput.getText().toString().trim();
        if (area.isEmpty() || area.length() > 120) {
            setMonitorStatus("Enter a public area label to share automated connectivity status.");
            return;
        }

        long now = System.currentTimeMillis();
        String previous = lastPublishedStatus.get(service);
        long lastTime = lastPublishedAt.containsKey(service) ? lastPublishedAt.get(service) : 0L;
        if (ConnectivityObservationUtils.shouldPublish(previous, status, lastTime, now)) {
            JSONObject body = new JSONObject();
            JSONObject observation = new JSONObject();
            try {
                observation.put("service", service);
                observation.put("status", status);
                observation.put("internetValidated", internetValidated);
                observation.put("observedAt", Instant.ofEpochMilli(now).toString());
                body.put("area", area);
                body.put("observation", observation);
            } catch (Exception error) {
                setMonitorStatus("Could not prepare the connectivity observation.");
                return;
            }

            lastPublishedStatus.put(service, status);
            lastPublishedAt.put(service, now);
            preferences.edit().putString(PREF_PENDING_PREFIX + service, body.toString()).apply();
            setMonitorStatus(
                (service.equals("wifi") ? "Wi-Fi" : "Mobile data") + ": " + status +
                ". The observation is queued locally until the pilot ingestion endpoint accepts it."
            );
        }

        if (internetValidated) flushPendingConnectivityObservations();
    }

    private void flushPendingConnectivityObservations() {
        if (!activityVisible || preferences == null ||
            !preferences.getBoolean(PREF_MONITOR_ENABLED, false)) return;
        long now = System.currentTimeMillis();
        if (now - lastConnectivityUploadAttemptAt < 30_000L) return;

        Map<String, String> pending = new HashMap<>();
        for (String service : new String[] { "wifi", "mobile-data" }) {
            String payload = preferences.getString(PREF_PENDING_PREFIX + service, null);
            if (payload == null) continue;
            try {
                JSONObject json = new JSONObject(payload);
                JSONObject observation = json.getJSONObject("observation");
                long observedAt = Instant.parse(observation.getString("observedAt")).toEpochMilli();
                if (observedAt <= 0L || now - observedAt > 15 * 60 * 1000L) {
                    preferences.edit().remove(PREF_PENDING_PREFIX + service).apply();
                } else {
                    pending.put(service, payload);
                }
            } catch (Exception error) {
                preferences.edit().remove(PREF_PENDING_PREFIX + service).apply();
            }
        }
        if (pending.isEmpty()) return;

        lastConnectivityUploadAttemptAt = now;
        ioExecutor.execute(() -> {
            int uploaded = 0;
            String failureMessage = null;
            for (Map.Entry<String, String> item : pending.entrySet()) {
                HttpURLConnection connection = null;
                try {
                    connection = (HttpURLConnection) new URL(CONNECTIVITY_API_URL).openConnection();
                    connection.setRequestMethod("POST");
                    connection.setConnectTimeout(8_000);
                    connection.setReadTimeout(8_000);
                    connection.setDoOutput(true);
                    connection.setRequestProperty("Content-Type", "application/json; charset=utf-8");
                    connection.setRequestProperty("Accept", "application/json");
                    byte[] payload = item.getValue().getBytes(StandardCharsets.UTF_8);
                    connection.setFixedLengthStreamingMode(payload.length);
                    try (OutputStream output = connection.getOutputStream()) {
                        output.write(payload);
                    }
                    int code = connection.getResponseCode();
                    InputStream stream = code >= 200 && code < 400
                        ? connection.getInputStream() : connection.getErrorStream();
                    String responseBody = readAll(stream);
                    JSONObject response = new JSONObject(responseBody.isEmpty() ? "{}" : responseBody);
                    if (code == 200 || code == 201) {
                        String current = preferences.getString(PREF_PENDING_PREFIX + item.getKey(), null);
                        if (item.getValue().equals(current)) {
                            preferences.edit().remove(PREF_PENDING_PREFIX + item.getKey()).apply();
                        }
                        uploaded += response.optInt("accepted", 0);
                    } else if ("connectivity_ingest_disabled".equals(response.optString("error"))) {
                        failureMessage = "Local queue is safe. The server-side connectivity pilot is not enabled yet.";
                    } else if ("area_not_in_pilot".equals(response.optString("error"))) {
                        failureMessage = "This area is not on the server's pilot allowlist. Nothing was shared.";
                    } else if (code == 429) {
                        failureMessage = "The server is rate-limiting updates. Pending status remains on this phone.";
                    } else {
                        failureMessage = "Connectivity status was not shared (HTTP " + code + "). Pending data remains on this phone.";
                    }
                } catch (Exception error) {
                    failureMessage = "Could not reach the server. Pending connectivity status remains on this phone.";
                } finally {
                    if (connection != null) connection.disconnect();
                }
            }

            final int uploadedCount = uploaded;
            final String finalFailure = failureMessage;
            runOnUiThread(() -> {
                if (uploadedCount > 0) {
                    setMonitorStatus("Shared " + uploadedCount + " automatic connectivity update(s). No location or device identifier was included.");
                } else if (finalFailure != null) {
                    setMonitorStatus(finalFailure);
                }
            });
        });
    }

    private String readAll(InputStream stream) throws Exception {
        if (stream == null) return "";
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) builder.append(line);
        }
        return builder.toString();
    }

    private void setStatus(String value) {
        if (statusView != null) statusView.setText(value);
    }

    private Button button(String label) {
        Button button = new Button(this);
        button.setText(label);
        button.setAllCaps(false);
        button.setTextSize(15);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setTextColor(Color.WHITE);
        button.setBackgroundTintList(android.content.res.ColorStateList.valueOf(Color.rgb(8, 126, 128)));
        button.setPadding(dp(12), dp(6), dp(12), dp(6));
        return button;
    }

    private TextView text(String value, int sizeSp, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(sizeSp);
        view.setTextColor(color);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        view.setGravity(Gravity.START);
        return view;
    }

    private LinearLayout.LayoutParams params(int width, int height) {
        return new LinearLayout.LayoutParams(width, height);
    }

    private int dp(float value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class NetworkObservation {
        final String networkName;
        final int signalDbm;
        final int frequencyMhz;
        final String security;
        final long observedAtMillis;
        final long ageSeconds;

        NetworkObservation(String networkName, int signalDbm, int frequencyMhz,
                           String security, long observedAtMillis, long ageSeconds) {
            this.networkName = networkName;
            this.signalDbm = signalDbm;
            this.frequencyMhz = frequencyMhz;
            this.security = security;
            this.observedAtMillis = observedAtMillis;
            this.ageSeconds = ageSeconds;
        }
    }
}
