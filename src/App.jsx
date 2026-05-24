import { useEffect } from 'react';
import { useECG } from './lib/ECGContext';
import AIConfigSection from './components/AIConfigSection';
import ConditionInput from './components/ConditionInput';
import DisplayOptionsSection from './components/DisplayOptionsSection';
import InterpretationSection from './components/InterpretationSection';
import ECGDisplay from './components/ECGDisplay';
import Toast from './components/Toast';
import './index.css';

export default function App() {
    const { loadConfig } = useECG();

    useEffect(() => {
        loadConfig();
    }, [loadConfig]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                document.getElementById('generateBtn')?.click();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, []);

    return (
        <div className="app-container">
            <header className="app-header">
                <div className="logo">
                    <svg viewBox="0 0 24 24" width="28" height="28" className="heartbeat-icon">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="currentColor"/>
                    </svg>
                    <h1>AI ECG Generator</h1>
                </div>
                <span className="separator-dot"></span>
                <p className="subtitle">12导联智能心电图生成系统</p>
            </header>

            <main className="main-content">
                <aside className="control-panel">
                    <AIConfigSection />
                    <ConditionInput />
                    <DisplayOptionsSection />
                    <InterpretationSection />
                </aside>

                <ECGDisplay />
            </main>

            <Toast />
        </div>
    );
}
