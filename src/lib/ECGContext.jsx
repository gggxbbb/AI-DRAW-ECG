import { createContext, useContext, useReducer, useRef, useCallback } from 'react';
import { ECGRenderer } from '../lib/ecg-renderer';
import { AIClient } from '../lib/ai-client';
import { ToolExecutor } from '../lib/tool-executor';
import { ecgAnalyzer } from '../lib/ecg-analyzer';

const ECGContext = createContext(null);

const initialState = {
    aiConfig: { endpoint: '', token: '', model: 'gpt-4o', temperature: 0.3, reasoningEffort: '' },
    displayConfig: { paperSpeed: 25, gain: 10, showGrid: true, showLabels: true },
    currentParams: null,
    interpretation: null,
    aiInterpretation: null,
    aiLeadDescriptions: null,
    headerInfo: null,
    programmaticAnalysis: null,
    rawReasoning: '',
    lastReasoningCat: '',
    streamProgress: '',
    progressBar: '',
    progressPhase: '',
    status: { text: '', className: '' },
    isGenerating: false,
    toasts: [],
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_AI_CONFIG': return { ...state, aiConfig: { ...state.aiConfig, ...action.payload } };
        case 'SET_DISPLAY_CONFIG': return { ...state, displayConfig: { ...state.displayConfig, ...action.payload } };
        case 'SET_PARAMS': return { ...state, currentParams: action.payload };
        case 'SET_INTERPRETATION': return { ...state, interpretation: action.payload };
        case 'SET_AI_INTERPRETATION': return { ...state, aiInterpretation: action.payload };
        case 'SET_AI_LEAD_DESCRIPTIONS': return { ...state, aiLeadDescriptions: action.payload };
        case 'SET_HEADER_INFO': return { ...state, headerInfo: action.payload };
        case 'SET_PROGRAMMATIC_ANALYSIS': return { ...state, programmaticAnalysis: action.payload };
        case 'APPEND_REASONING': {
            const cat = action.category || '';
            const lastCat = state.lastReasoningCat;
            const close = (cat && cat !== lastCat && lastCat) ? `[/${lastCat}]` : '';
            const open = (cat && cat !== lastCat) ? `[${cat}]` : '';
            return { ...state, rawReasoning: state.rawReasoning + close + open + action.payload, lastReasoningCat: cat || lastCat };
        }
        case 'CLEAR_REASONING': return { ...state, rawReasoning: '', lastReasoningCat: '' };
        case 'SET_STREAM_PROGRESS': return { ...state, streamProgress: action.payload };
        case 'SET_PROGRESS_BAR': return { ...state, progressBar: action.payload };
        case 'SET_PROGRESS_PHASE': return { ...state, progressPhase: action.payload };
        case 'SET_STATUS': return { ...state, status: action.payload };
        case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
        case 'ADD_TOAST':
            return { ...state, toasts: [...state.toasts, action.payload] };
        case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        default: return state;
    }
}

function progressBarStr(count, phase) {
    const phases = { init: '初始化', leads: `导联 ${count}/12`, rhythm: '节律带', interp: 'AI解读', desc: '导联描述', done: '完成' };
    const p = phase || 'leads';
    return `${phases[p] || p}`;
}

export function ECGProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const rendererRef = useRef(null);
    const aiClientRef = useRef(new AIClient());
    let executorRef = null;

    const getRenderer = useCallback(() => rendererRef.current, []);
    const setRenderer = useCallback((r) => { rendererRef.current = r; }, []);

    const addToast = useCallback((message, type = 'info') => {
        const icons = { success: '\u2713', error: '\u2717', warning: '!', info: 'i' };
        const id = Date.now() + Math.random();
        dispatch({ type: 'ADD_TOAST', payload: { message, type, icon: icons[type] || icons.info, id } });
        setTimeout(() => dispatch({ type: 'REMOVE_TOAST', payload: id }), 4000);
    }, []);

    const loadConfig = useCallback(() => {
        try {
            const saved = localStorage.getItem('ecg-ai-config');
            if (saved) {
                const cfg = JSON.parse(saved);
                dispatch({ type: 'SET_AI_CONFIG', payload: cfg });
                aiClientRef.current.configure(cfg.endpoint || '', cfg.token || '', cfg.model || 'gpt-4o', cfg.temperature ?? 0.3);
            }
        } catch (e) {}
    }, []);

    const saveConfig = useCallback((config) => {
        try { localStorage.setItem('ecg-ai-config', JSON.stringify(config)); }
        catch (e) {}
    }, []);

    const handleGenerateStream = useCallback(async (condition, additionalParams) => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        dispatch({ type: 'CLEAR_REASONING' });
        dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
        dispatch({ type: 'SET_PROGRESS_BAR', payload: '' });
        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'init' });
        dispatch({ type: 'SET_HEADER_INFO', payload: null });
        dispatch({ type: 'SET_PARAMS', payload: null });
        dispatch({ type: 'SET_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: null });
        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: null });

        const renderer = rendererRef.current;
        if (!renderer) { dispatch({ type: 'SET_GENERATING', payload: false }); return; }

        executorRef = new ToolExecutor(renderer);
        renderer._autoFit = true;
        renderer.setPaperSpeed(state.displayConfig.paperSpeed);
        renderer.setGain(state.displayConfig.gain);
        renderer.setGrid(state.displayConfig.showGrid);
        renderer.setLabels(state.displayConfig.showLabels);

        let totalLeads = 0;
        let roundErrors = [];

        try {
            roundErrors = [];
            await aiClientRef.current.generateMultiRound(
                condition, additionalParams,
                (text, type) => {
                    if (type === 'reasoning') {
                        dispatch({ type: 'APPEND_REASONING', payload: text, category: '推理' });
                    }
                },
                (toolCall, idx, round) => {
                    dispatch({ type: 'SET_STATUS', payload: { text: `第${round}轮 · 工具#${idx + 1}`, className: 'status-loading' } });
                    const toolLabel = ['drawLeadCurve', 'drawLeadCurveCSV'].includes(toolCall.tool)
                        ? `${toolCall.tool.replace('drawLeadCurve', '导联').replace('CSV', '(CSV)')} → ${toolCall.lead}`
                        : toolCall.tool;
                    dispatch({ type: 'APPEND_REASONING', payload: toolLabel, category: '工具' });
                    const result = executorRef.executeSingle(toolCall, (lead, count) => {
                        totalLeads = count;
                        dispatch({ type: 'SET_STREAM_PROGRESS', payload: `${lead} (${count}/12)` });
                        dispatch({ type: 'SET_PROGRESS_BAR', payload: progressBarStr(count, 'leads') });
                        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'leads' });
                    });
                    if (!result.success) {
                        dispatch({ type: 'APPEND_REASONING', payload: result.errors.join('; '), category: '错误' });
                        roundErrors.push(...result.errors);
                        return;
                    }
                    if (result.warned) {
                        dispatch({ type: 'APPEND_REASONING', payload: `${result.lead} 验证警告: ${result.warning}（AI 执意绘制）`, category: '警告' });
                    }
                    if (result.action === 'init') {
                        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'init' });
                        dispatch({ type: 'SET_PROGRESS_BAR', payload: '初始化完成' });
                        dispatch({ type: 'SET_PARAMS', payload: executorRef.storedParams });
                    }
                    if (result.action === 'writeHeaderInfo') {
                        dispatch({ type: 'SET_HEADER_INFO', payload: executorRef.headerInfo });
                    }
                    if (result.action === 'drawRhythmStrip') {
                        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'rhythm' });
                        dispatch({ type: 'SET_PROGRESS_BAR', payload: '节律带' });
                        const curves = renderer._leadCurves || {};
                        const prog = ecgAnalyzer.analyze(executorRef.storedParams, curves);
                        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: prog });
                    }
                    if (result.action === 'writeInterpretation') {
                        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'interp' });
                        dispatch({ type: 'SET_PROGRESS_BAR', payload: 'AI 解读' });
                        dispatch({ type: 'SET_AI_INTERPRETATION', payload: executorRef.aiInterpretation });
                    }
                    if (result.complete || (result.action === 'drawRhythmStrip' && executorRef.leadCount >= 12)) {
                        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'desc' });
                        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: executorRef.aiLeadDescriptions || null });
                    }
                    lastAction = result.action;
                },
                (info) => {
                    if (info.type === 'round') {
                        roundErrors = [];
                        dispatch({ type: 'SET_STATUS', payload: { text: `第${info.round}轮生成中...`, className: 'status-loading' } });
                    }
                    if (info.type === 'roundDone') {
                        dispatch({ type: 'APPEND_REASONING', payload: `第${info.round}轮完成 (${info.count}个工具调用)`, category: '状态' });
                    }
                    if (info.type === 'getStatus') {
                        if (!executorRef) return { complete: true, remaining: [], errors: [] };
                        return {
                            complete: executorRef.isComplete,
                            remaining: executorRef.getRemainingTasks(),
                            errors: roundErrors,
                        };
                    }
                },
                state.aiConfig.reasoningEffort === 'off' ? 'none' : (state.aiConfig.reasoningEffort || undefined)
            );

            dispatch({ type: 'SET_STATUS', payload: { text: 'AI生成完成', className: 'status-success' } });
            dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
            dispatch({ type: 'SET_PROGRESS_BAR', payload: '' });
            if (!executorRef.aiLeadDescriptions) {
                dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: executorRef.aiLeadDescriptions });
            }
            addToast('心电图生成完成', 'success');
        } catch (err) {
            dispatch({ type: 'SET_STATUS', payload: { text: `失败: ${err.message}`, className: 'status-error' } });
            dispatch({ type: 'APPEND_REASONING', payload: `\n## 异常: ${err.message}\n` });
        } finally {
            dispatch({ type: 'SET_GENERATING', payload: false });
        }
    }, [state.displayConfig, addToast]);

    const handleTestConnection = useCallback(async (endpoint, token, model, temperature) => {
        aiClientRef.current.configure(endpoint, token, model, temperature);
        try { const r = await aiClientRef.current.testConnection(); addToast('连接成功', 'success'); return { success: true, model: r.model }; }
        catch (err) { addToast(err.message, 'error'); return { success: false, message: err.message }; }
    }, [addToast]);

    const value = { state, dispatch, getRenderer, setRenderer, addToast, loadConfig, saveConfig, handleGenerateStream, handleTestConnection, aiClientRef };
    return <ECGContext.Provider value={value}>{children}</ECGContext.Provider>;
}

export function useECG() {
    const ctx = useContext(ECGContext);
    if (!ctx) throw new Error('useECG must be used within ECGProvider');
    return ctx;
}
