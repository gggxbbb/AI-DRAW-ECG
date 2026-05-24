import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ECGProvider } from './lib/ECGContext';

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ECGProvider>
            <App />
        </ECGProvider>
    </React.StrictMode>
);
