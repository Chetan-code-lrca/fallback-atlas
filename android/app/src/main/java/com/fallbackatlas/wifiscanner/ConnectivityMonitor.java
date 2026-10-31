package com.fallbackatlas.wifiscanner;

import android.content.Context;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.NetworkRequest;

import java.util.HashMap;
import java.util.Map;

final class ConnectivityMonitor {
    interface Listener {
        void onObservation(String service, String status, boolean internetValidated);
        void onMonitorError(String message);
    }

    private final ConnectivityManager connectivityManager;
    private final Listener listener;
    private final Map<Network, String> wifiStates = new HashMap<>();
    private final Map<Network, String> cellularStates = new HashMap<>();
    private ConnectivityManager.NetworkCallback wifiCallback;
    private ConnectivityManager.NetworkCallback cellularCallback;
    private boolean started;

    ConnectivityMonitor(Context context, Listener listener) {
        this.connectivityManager = (ConnectivityManager) context.getSystemService(Context.CONNECTIVITY_SERVICE);
        this.listener = listener;
    }

    boolean start() {
        if (started) return true;
        if (connectivityManager == null) {
            listener.onMonitorError("Android connectivity monitoring is unavailable on this device.");
            return false;
        }

        wifiCallback = createCallback("wifi", wifiStates);
        cellularCallback = createCallback("mobile-data", cellularStates);
        try {
            NetworkRequest wifiRequest = new NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_WIFI)
                .build();
            NetworkRequest cellularRequest = new NetworkRequest.Builder()
                .addTransportType(NetworkCapabilities.TRANSPORT_CELLULAR)
                .build();
            connectivityManager.registerNetworkCallback(wifiRequest, wifiCallback);
            connectivityManager.registerNetworkCallback(cellularRequest, cellularCallback);
            started = true;
            return true;
        } catch (RuntimeException error) {
            stop();
            listener.onMonitorError("Android could not start network monitoring. Check system restrictions and try again.");
            return false;
        }
    }

    void stop() {
        if (connectivityManager != null) {
            if (wifiCallback != null) {
                try { connectivityManager.unregisterNetworkCallback(wifiCallback); }
                catch (IllegalArgumentException ignored) { /* callback was not registered */ }
            }
            if (cellularCallback != null) {
                try { connectivityManager.unregisterNetworkCallback(cellularCallback); }
                catch (IllegalArgumentException ignored) { /* callback was not registered */ }
            }
        }
        wifiCallback = null;
        cellularCallback = null;
        wifiStates.clear();
        cellularStates.clear();
        started = false;
    }

    boolean isStarted() {
        return started;
    }

    private ConnectivityManager.NetworkCallback createCallback(
        String service,
        Map<Network, String> states
    ) {
        return new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(Network network, NetworkCapabilities capabilities) {
                boolean hasInternet = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET);
                boolean validated = capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
                String status = ConnectivityObservationUtils.statusForCapabilities(hasInternet, validated);
                String aggregate;
                synchronized (states) {
                    states.put(network, status);
                    aggregate = ConnectivityObservationUtils.aggregateStatus(states.values());
                }
                listener.onObservation(service, aggregate, "working".equals(aggregate));
            }

            @Override
            public void onLost(Network network) {
                String aggregate;
                boolean changed;
                synchronized (states) {
                    changed = states.remove(network) != null;
                    aggregate = ConnectivityObservationUtils.aggregateStatus(states.values());
                }
                if (changed) {
                    listener.onObservation(service, aggregate, "working".equals(aggregate));
                }
            }
        };
    }
}
