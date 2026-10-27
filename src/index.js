import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';

ReactDOM.render(<App />, document.getElementById('root'));

// Cache the application shell for outage scenarios. API calls and map tiles
// are deliberately not cached by the service worker.
if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js').catch(() => {
      // Offline shell is an enhancement; app startup must still succeed without it.
    });
  });
}
