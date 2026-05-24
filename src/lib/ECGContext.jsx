import { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import { ECGRenderer } from '../lib/ecg-renderer';
import { AIClient } from '../lib/ai-client';
import { ToolExecutor } from '../lib/tool-executor';
import { ecgAnalyzer } from '../lib/ecg-analyzer';

const ECGContext = createContext(null);

const initialState = {
    aiConfig: { endpoint: '', token: '', model: 'gpt-4o', temperature: 0.3 },
    displayConfig: { paperSpeed: 25, gain: 10, showGrid: true, showLabels: true },
    currentParams: null,
    interpretation: null,
    aiInterpretation: null,
    aiLeadDescriptions: null,
    programmaticAnalysis: null,
    status: { text: '', className: '' },
    isGenerating: false,
    streamProgress: '',
    toasts: [],
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_AI_CONFIG':
            return { ...state, aiConfig: { ...state.aiConfig, ...action.payload } };
        case 'SET_DISPLAY_CONFIG':
            return { ...state, displayConfig: { ...state.displayConfig, ...action.payload } };
        case 'SET_PARAMS':
            return { ...state, currentParams: action.payload };
        case 'SET_INTERPRETATION':
            return { ...state, interpretation: action.payload };
        case 'SET_AI_INTERPRETATION':
            return { ...state, aiInterpretation: action.payload };
        case 'SET_AI_LEAD_DESCRIPTIONS':
            return { ...state, aiLeadDescriptions: action.payload };
        case 'SET_PROGRAMMATIC_ANALYSIS':
            return { ...state, programmaticAnalysis: action.payload };
        case 'SET_STATUS':
            return { ...state, status: action.payload };
        case 'SET_GENERATING':
            return { ...state, isGenerating: action.payload };
        case 'SET_STREAM_PROGRESS':
            return { ...state, streamProgress: action.payload };
        case 'ADD_TOAST': {
            const id = Date.now() + Math.random();
            return { ...state, toasts: [...state.toasts, { id, ...action.payload }] };
        }
        case 'REMOVE_TOAST':
            return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        default:
            return state;
    }
}

export function ECGProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const rendererRef = useRef(null);
    const aiClientRef = useRef(new AIClient());

    const getRenderer = useCallback(() => rendererRef.current, []);
    const setRenderer = useCallback((r) => { rendererRef.current = r; }, []);

    const addToast = useCallback((message, type = 'info') => {
        const icons = { success: '\u2713', error: '\u2717', warning: '!', info: 'i' };
        const toast = { message, type, icon: icons[type] || icons.info };
        dispatch({ type: 'ADD_TOAST', payload: toast });
        setTimeout(() => {
            dispatch({ type: 'REMOVE_TOAST', payload: toast.id });
        }, 4000);
    }, []);

    const loadConfig = useCallback(() => {
        try {
            const saved = localStorage.getItem('ecg-ai-config');
            if (saved) {
                const cfg = JSON.parse(saved);
                dispatch({ type: 'SET_AI_CONFIG', payload: cfg });
                aiClientRef.current.configure(cfg.endpoint || '', cfg.token || '', cfg.model || 'gpt-4o', cfg.temperature ?? 0.3);
                return cfg;
            }
        } catch (e) { /* ignore */ }
        return null;
    }, []);

    const saveConfig = useCallback((config) => {
        try { localStorage.setItem('ecg-ai-config', JSON.stringify(config)); }
        catch (e) { /* ignore */ }
    }, []);

    const handleGenerateStream = useCallback(async (condition, additionalParams) => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        dispatch({ type: 'SET_STATUS', payload: { text: 'AI生成中...', className: 'status-loading' } });
        dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
        dispatch({ type: 'SET_PARAMS', payload: null });
        dispatch({ type: 'SET_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: null });
        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: null });

        const renderer = rendererRef.current;
        if (!renderer) {
            dispatch({ type: 'SET_GENERATING', payload: false });
            addToast('渲染器未初始化', 'error');
            return;
        }

        const executor = new ToolExecutor(renderer);
        renderer.setPaperSpeed(state.displayConfig.paperSpeed);
        renderer.setGain(state.displayConfig.gain);
        renderer.setGrid(state.displayConfig.showGrid);
        renderer.setLabels(state.displayConfig.showLabels);

        try {
            await aiClientRef.current.generateECGToolsStream(
                condition,
                additionalParams,
                (toolCall, index) => {
                    const result = executor.executeSingle(toolCall, (lead, count) => {
                        dispatch({ type: 'SET_STREAM_PROGRESS', payload: `${lead} (${count}/12)` });
                    });
                    if (!result.success) {
                        addToast(`${result.errors.join('; ')}`, 'warning');
                        return;
                    }
                    if (result.action === 'init') {
                        dispatch({ type: 'SET_PARAMS', payload: executor.storedParams });
                    }
                    if (result.action === 'drawRhythmStrip') {
                        const prog = ecgAnalyzer.analyze(executor.storedParams);
                        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: prog });
                        dispatch({ type: 'SET_STATUS', payload: { text: '生成解读中...', className: 'status-loading' } });
                    }
                    if (result.action === 'writeInterpretation') {
                        dispatch({ type: 'SET_AI_INTERPRETATION', payload: executor.aiInterpretation });
                        dispatch({ type: 'SET_STATUS', payload: { text: '生成导联描述中...', className: 'status-loading' } });
                    }
                    if (result.complete) {
                        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: executor.aiLeadDescriptions });
                        dispatch({ type: 'SET_STATUS', payload: { text: 'AI生成完成', className: 'status-success' } });
                        dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
                        addToast('心电图生成完成', 'success');
                    }
                }
            );
        } catch (err) {
            dispatch({ type: 'SET_STATUS', payload: { text: `失败: ${err.message}`, className: 'status-error' } });
            addToast(err.message, 'error');
        } finally {
            dispatch({ type: 'SET_GENERATING', payload: false });
        }
    }, [state.displayConfig, addToast]);

    const handleTestConnection = useCallback(async (endpoint, token, model, temperature) => {
        aiClientRef.current.configure(endpoint, token, model, temperature);
        try {
            const result = await aiClientRef.current.testConnection();
            addToast('连接成功', 'success');
            return { success: true, model: result.model };
        } catch (err) {
            addToast(err.message, 'error');
            return { success: false, message: err.message };
        }
    }, [addToast]);

    const value = {
        state,
        dispatch,
        getRenderer,
        setRenderer,
        addToast,
        loadConfig,
        saveConfig,
        handleGenerateStream,
        handleTestConnection,
        aiClientRef,
    };

    return (
        <ECGContext.Provider value={value}>
            {children}
        </ECGContext.Provider>
    );
}

export function useECG() {
    const ctx = useContext(ECGContext);
    if (!ctx) throw new Error('useECG must be used within ECGProvider');
    return ctx;
}
