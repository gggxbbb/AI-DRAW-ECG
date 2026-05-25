import { useEffect } from 'react';
import { useECG } from './lib/ECGContext';
import AIConfigSection from './components/AIConfigSection';
import ConditionInput from './components/ConditionInput';
import DisplayOptionsSection from './components/DisplayOptionsSection';
import InterpretationSection from './components/InterpretationSection';
import RawOutput from './components/RawOutput';
import HistoryPanel from './components/HistoryPanel';
import ECGDisplay from './components/ECGDisplay';
import Toast from './components/Toast';
import './index.css';

export default function App() {
    const { loadConfig, loadHistoryInit, state } = useECG();
    const pyStatus = state.pyodideStatus;
    const pyStatusLabel = { idle: '', loading: 'Python 加载中...', ready: 'Python 就绪', error: 'Python 加载失败' }[pyStatus];
    const pyStatusClass = { idle: '', loading: 'status-loading', ready: 'status-success', error: 'status-error' }[pyStatus];

    useEffect(() => {
        loadConfig();
        loadHistoryInit();
    }, [loadConfig, loadHistoryInit]);

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
                <p className="subtitle">AI 驱动的 12 导联心电图生成器</p>
                {pyStatus !== 'idle' && (
                    <>
                        <span className="separator-dot"></span>
                        <span className={`pyodide-badge ${pyStatusClass}`}>
                            {pyStatus === 'loading' && <span className="py-spinner"></span>}
                            {pyStatus === 'ready' && <span className="py-check">&#x2713;</span>}
                            {pyStatus === 'error' && <span className="py-error-icon">&#x2717;</span>}
                            {pyStatusLabel}
                        </span>
                    </>
                )}
            </header>

            <main className="main-content">
                <aside className="control-panel">
                    <AIConfigSection />
                    <HistoryPanel />
                    <ConditionInput />
                    <DisplayOptionsSection />
                    <InterpretationSection />
                    <RawOutput />
                    <div style={{flex: 1}} />
                    <div style={{padding: '8px 0 0', borderTop: '1px solid var(--border-light)'}}>
                        <a href="https://github.com/gggxbbb/AI-DRAW-ECG" target="_blank" rel="noopener"
                            style={{display: 'flex', alignItems: 'center', gap: 6, color: '#5a6c7a', textDecoration: 'none', fontSize: '0.72rem'}}>
                            <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
                            </svg>
                            AI-DRAW-ECG on GitHub
                        </a>
                    </div>
                </aside>

                <ECGDisplay />
            </main>

            <Toast />
        </div>
    );
}
