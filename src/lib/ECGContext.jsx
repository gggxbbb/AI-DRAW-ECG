import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react';
import { ECGRenderer } from '../lib/ecg-renderer';
import { AIClient } from '../lib/ai-client';
import { ToolExecutor } from '../lib/tool-executor';
import { ecgAnalyzer } from '../lib/ecg-analyzer';
import { loadHistory, addHistoryRecord, deleteHistoryRecord, clearHistory } from '../lib/ecg-history';
import { pyodideRuntime } from '../lib/pyodide-runtime';

const ECGContext = createContext(null);

const initialState = {
    aiConfig: { endpoint: '', token: '', model: 'gpt-4o', temperature: 0.3, reasoningEffort: '' },
    displayConfig: { paperSpeed: 25, gain: 10, showGrid: true, showLabels: true, showAnnotations: false },
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
    tokenUsage: null,
    toasts: [],
    history: [],
    pyodideStatus: 'idle',
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
        case 'SET_TOKEN_USAGE': return { ...state, tokenUsage: action.payload };
        case 'SET_STATUS': return { ...state, status: action.payload };
        case 'SET_GENERATING': return { ...state, isGenerating: action.payload };
        case 'ADD_TOAST':
            return { ...state, toasts: [...state.toasts, action.payload] };
        case 'REMOVE_TOAST': return { ...state, toasts: state.toasts.filter(t => t.id !== action.payload) };
        case 'SET_HISTORY': return { ...state, history: action.payload };
        case 'DELETE_FROM_HISTORY': return { ...state, history: state.history.filter(r => r.id !== action.payload) };
        case 'CLEAR_HISTORY': return { ...state, history: [] };
        case 'SET_PYODIDE_STATUS': return { ...state, pyodideStatus: action.payload };
        default: return state;
    }
}

function progressBarStr(count, phase) {
    const phases = { init: '初始化', leads: `导联 ${count}/12`, rhythm: '节律带', analysis: '程序分析中', redraw: 'AI 重绘', interp: 'AI解读', desc: '导联描述', done: '完成' };
    const p = phase || 'leads';
    return `${phases[p] || p}`;
}

export function ECGProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);
    const rendererRef = useRef(null);
    const aiClientRef = useRef(new AIClient());
    const autoSaveIdRef = useRef(null);
    let executorRef = null;

    const getRenderer = useCallback(() => rendererRef.current, []);
    const setRenderer = useCallback((r) => { rendererRef.current = r; }, []);

    useEffect(() => {
        dispatch({ type: 'SET_PYODIDE_STATUS', payload: pyodideRuntime.status });
        const unsub = pyodideRuntime.onChange((status) => {
            dispatch({ type: 'SET_PYODIDE_STATUS', payload: status });
        });
        setTimeout(() => pyodideRuntime.preload(), 3000);
        return unsub;
    }, []);

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

    const loadHistoryInit = useCallback(() => {
        dispatch({ type: 'SET_HISTORY', payload: loadHistory() });
    }, []);

    const handleSaveToHistory = useCallback((record) => {
        const history = addHistoryRecord(record);
        dispatch({ type: 'SET_HISTORY', payload: history });
        autoSaveIdRef.current = record.id;
    }, []);

    const handleDeleteHistory = useCallback((id) => {
        const history = deleteHistoryRecord(id);
        dispatch({ type: 'SET_HISTORY', payload: history });
    }, []);

    const handleClearHistory = useCallback(() => {
        clearHistory();
        dispatch({ type: 'CLEAR_HISTORY' });
    }, []);

    const handleRestoreHistory = useCallback((record) => {
        const renderer = rendererRef.current;
        if (!renderer || !record.currentParams || !record.leadCurves) return;

        dispatch({ type: 'SET_DISPLAY_CONFIG', payload: record.displayConfig });
        renderer.setPaperSpeed(record.displayConfig.paperSpeed);
        renderer.setGain(record.displayConfig.gain);
        renderer.setGrid(record.displayConfig.showGrid);
        renderer.setLabels(record.displayConfig.showLabels);
        renderer.setAnnotations(record.displayConfig.showAnnotations);

        renderer.renderInit(record.currentParams, { keepCurves: true });
        renderer.restoreCurves(record.leadCurves);
        renderer._redrawStoredCurves(record.currentParams);

        if (record.headerInfo) renderer.drawHeaderText(record.headerInfo);

        dispatch({ type: 'SET_PARAMS', payload: record.currentParams });
        dispatch({ type: 'SET_HEADER_INFO', payload: record.headerInfo });
        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: record.programmaticAnalysis });
        dispatch({ type: 'SET_AI_INTERPRETATION', payload: record.aiInterpretation });
        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: record.aiLeadDescriptions });
        dispatch({ type: 'SET_TOKEN_USAGE', payload: record.tokenUsage });

        autoSaveIdRef.current = record.id;
    }, []);

    const handleGenerateStream = useCallback(async (condition, additionalParams) => {
        dispatch({ type: 'SET_GENERATING', payload: true });
        dispatch({ type: 'CLEAR_REASONING' });
        dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
        dispatch({ type: 'SET_PROGRESS_BAR', payload: '' });
        dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'init' });
        dispatch({ type: 'SET_HEADER_INFO', payload: null });
        dispatch({ type: 'SET_TOKEN_USAGE', payload: null });
        dispatch({ type: 'SET_PARAMS', payload: null });
        dispatch({ type: 'SET_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_INTERPRETATION', payload: null });
        dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: null });
        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: null });

        const autoSaveId = Date.now().toString();
        autoSaveIdRef.current = autoSaveId;

        const renderer = rendererRef.current;
        if (!renderer) { dispatch({ type: 'SET_GENERATING', payload: false }); return; }

        executorRef = new ToolExecutor(renderer);
        renderer._autoFit = true;
        renderer.setPaperSpeed(state.displayConfig.paperSpeed);
        renderer.setGain(state.displayConfig.gain);
        renderer.setGrid(state.displayConfig.showGrid);
        renderer.setLabels(state.displayConfig.showLabels);
        renderer.setAnnotations(false);
        renderer.setAnnotationData(null);

        let totalLeads = 0;
        let roundErrors = [];
        let currentTokenUsage = null;
        let currentIteration = 0;

        try {
            roundErrors = [];

            const executeTool = async (toolCall) => {
                const toolLabel = ['drawLeadCurve', 'drawLeadCurveCSV', 'drawRhythmStripCSV', 'drawAllLeadsCSV'].includes(toolCall.tool)
                    ? `${toolCall.tool.replace('drawLeadCurve', '导联').replace('CSV', '(CSV)').replace('drawRhythmStripCSV', '节律带(CSV)')}${toolCall.lead ? ' → ' + toolCall.lead : ''}`
                    : toolCall.tool;
                dispatch({ type: 'APPEND_REASONING', payload: toolLabel, category: '工具' });

                const result = await executorRef.executeSingle(toolCall, (lead, count) => {
                    totalLeads = count;
                    dispatch({ type: 'SET_STREAM_PROGRESS', payload: `${lead} (${count}/12)` });
                    dispatch({ type: 'SET_PROGRESS_BAR', payload: progressBarStr(count, 'leads') });
                    dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'leads' });
                });

                if (!result.success) {
                    dispatch({ type: 'APPEND_REASONING', payload: result.errors.join('; '), category: '错误' });
                    roundErrors.push(...result.errors);
                    return result;
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
                if (result.action === 'drawLeadCurve' || result.action === 'drawLeadCurveCSV' || result.action === 'drawAllLeadsCSV') {
                    const curves = renderer._leadCurves || {};
                    if (Object.keys(curves).length >= 3 && executorRef.storedParams) {
                        const prog = ecgAnalyzer.analyze(executorRef.storedParams, curves);
                        dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: prog });
                        executorRef.programmaticAnalysis = prog;
                        executorRef.rhythmConsistency = ecgAnalyzer.checkRhythmConsistency(executorRef.storedParams, curves);
                    }
                }
                if (result.action === 'drawRhythmStrip' || result.action === 'drawRhythmStripCSV') {
                    dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'rhythm' });
                    dispatch({ type: 'SET_PROGRESS_BAR', payload: '节律带' });
                    const curves = renderer._leadCurves || {};
                    const prog = ecgAnalyzer.analyze(executorRef.storedParams, curves);
                    dispatch({ type: 'SET_PROGRAMMATIC_ANALYSIS', payload: prog });
                    executorRef.programmaticAnalysis = prog;
                    executorRef.rhythmConsistency = ecgAnalyzer.checkRhythmConsistency(executorRef.storedParams, curves);
                    dispatch({ type: 'SET_PROGRESS_PHASE', payload: 'analysis' });
                    dispatch({ type: 'SET_PROGRESS_BAR', payload: prog.conclusion === '未见明显异常' ? '分析：未见异常' : '分析：' + prog.conclusion });
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
                if (result.action === 'runPythonCode' && result.result) {
                    if (result.result.stdout) {
                        dispatch({ type: 'APPEND_REASONING', payload: `\n${result.result.stdout}`, category: '输出' });
                    }
                    if (result.result.stderr) {
                        dispatch({ type: 'APPEND_REASONING', payload: `Python错误: ${result.result.stderr}`, category: '错误' });
                    }
                }

                return result;
            };

            const onProgress = (info) => {
                if (info.type === 'iteration') {
                    roundErrors = [];
                    currentIteration = info.iteration;
                    const rwNote = executorRef.redrawRound ? ' [重绘]' : '';
                    dispatch({ type: 'SET_STATUS', payload: { text: `第${info.iteration}轮生成中...${rwNote}`, className: 'status-loading' } });
                }
                if (info.type === 'toolStart') {
                    dispatch({ type: 'SET_STATUS', payload: { text: `第${info.iteration}轮 · ${info.toolCall.tool}`, className: 'status-loading' } });
                }
                if (info.type === 'iterationDone') {
                    dispatch({ type: 'APPEND_REASONING', payload: `第${info.iteration}轮完成 (${info.toolCount}个工具调用)`, category: '状态' });
                }
                if (info.type === 'usage') {
                    currentTokenUsage = {
                        prompt: (currentTokenUsage?.prompt || 0) + info.prompt_tokens,
                        completion: (currentTokenUsage?.completion || 0) + info.completion_tokens,
                        total: (currentTokenUsage?.total || 0) + info.total_tokens,
                    };
                    dispatch({ type: 'SET_TOKEN_USAGE', payload: currentTokenUsage });
                }
                if (info.type === 'getStatus') {
                    if (!executorRef) return { complete: true, remaining: [], errors: [] };
                    const analysis = executorRef.programmaticAnalysis;
                    const rhythm = executorRef.rhythmConsistency;
                    let analysisFeedback = null;
                    if (analysis && rhythm && executorRef.leadCount >= 12) {
                        const parts = [];
                        if (analysis.conclusion !== '未见明显异常') {
                            parts.push(`测量指标异常：${analysis.conclusion}`);
                            const abns = analysis.findings.filter(f => f.severity === 'abnormal' || f.severity === 'critical');
                            if (abns.length) parts.push(`发现：${abns.map(f => f.text).join('；')}`);
                        }
                        if (!rhythm.isConsistent) {
                            parts.push(`节律一致性检查失败：${rhythm.issues.join('；')}`);
                        }
                        if (parts.length) analysisFeedback = parts.join('\n');
                    }
                    let pythonOutput = null;
                    if (executorRef.lastPythonOutput) {
                        if (executorRef.lastPythonOutput.stdout) {
                            pythonOutput = executorRef.lastPythonOutput.stdout;
                        }
                        if (executorRef.lastPythonOutput.stderr) {
                            pythonOutput = (pythonOutput || '') + '\n[Python stderr]\n' + executorRef.lastPythonOutput.stderr;
                        }
                    }
                    return {
                        complete: executorRef.isComplete,
                        remaining: executorRef.getRemainingTasks(),
                        errors: roundErrors,
                        analysisFeedback,
                        pythonOutput,
                        context: {
                            params: executorRef.storedParams,
                            leadsDone: [...executorRef.leadNames],
                            headerInfo: executorRef.headerInfo,
                        },
                    };
                }
            };

            const genResult = await aiClientRef.current.agentLoop(
                condition, additionalParams,
                (text, type) => {
                    if (type === 'reasoning') {
                        dispatch({ type: 'APPEND_REASONING', payload: text, category: '推理' });
                    } else if (type === 'content') {
                        dispatch({ type: 'APPEND_REASONING', payload: text, category: '输出' });
                    }
                },
                executeTool,
                onProgress,
                state.aiConfig.reasoningEffort || undefined
            );

            if (genResult && genResult.aborted) {
                dispatch({ type: 'SET_STATUS', payload: { text: '已停止', className: '' } });
                dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
                dispatch({ type: 'SET_PROGRESS_BAR', payload: '' });
                return;
            }

            dispatch({ type: 'SET_STATUS', payload: { text: 'AI生成完成', className: 'status-success' } });
            dispatch({ type: 'SET_STREAM_PROGRESS', payload: '' });
            dispatch({ type: 'SET_PROGRESS_BAR', payload: '' });
            if (!executorRef.aiLeadDescriptions) {
                dispatch({ type: 'SET_AI_LEAD_DESCRIPTIONS', payload: executorRef.aiLeadDescriptions });
            }
            addToast('心电图生成完成', 'success');

            const historyRecord = {
                id: autoSaveIdRef.current,
                timestamp: new Date().toISOString(),
                condition: executorRef.headerInfo || condition || '',
                additionalParams: additionalParams || '',
                headerInfo: executorRef.headerInfo,
                currentParams: executorRef.storedParams ? { ...executorRef.storedParams } : null,
                displayConfig: { ...state.displayConfig },
                programmaticAnalysis: executorRef.programmaticAnalysis ? { ...executorRef.programmaticAnalysis } : null,
                aiInterpretation: executorRef.aiInterpretation,
                aiLeadDescriptions: executorRef.aiLeadDescriptions ? { ...executorRef.aiLeadDescriptions } : null,
                tokenUsage: currentTokenUsage ? { ...currentTokenUsage } : null,
                leadCurves: deepCopyCurvesForHistory(renderer._leadCurves || {}),
            };
            const history = addHistoryRecord(historyRecord);
            dispatch({ type: 'SET_HISTORY', payload: history });

            function deepCopyCurvesForHistory(curves) {
                const copy = {};
                for (const [lead, points] of Object.entries(curves)) {
                    if (Array.isArray(points)) {
                        copy[lead] = points.map(pt => [...pt]);
                    }
                }
                return copy;
            }
        } catch (err) {
            dispatch({ type: 'SET_STATUS', payload: { text: `失败: ${err.message}`, className: 'status-error' } });
            dispatch({ type: 'APPEND_REASONING', payload: `\n## 异常: ${err.message}\n` });
        } finally {
            dispatch({ type: 'SET_GENERATING', payload: false });
        }
    }, [state.displayConfig, addToast]);

    const handleStopGeneration = useCallback(() => {
        aiClientRef.current.abort();
    }, []);

    const handleTestConnection = useCallback(async (endpoint, token, model, temperature) => {
        aiClientRef.current.configure(endpoint, token, model, temperature);
        try { const r = await aiClientRef.current.testConnection(); addToast('连接成功', 'success'); return { success: true, model: r.model }; }
        catch (err) { addToast(err.message, 'error'); return { success: false, message: err.message }; }
    }, [addToast]);

    const value = { state, dispatch, getRenderer, setRenderer, addToast, loadConfig, saveConfig, loadHistoryInit, handleSaveToHistory, handleDeleteHistory, handleClearHistory, handleRestoreHistory, handleGenerateStream, handleStopGeneration, handleTestConnection, aiClientRef };
    return <ECGContext.Provider value={value}>{children}</ECGContext.Provider>;
}

export function useECG() {
    const ctx = useContext(ECGContext);
    if (!ctx) throw new Error('useECG must be used within ECGProvider');
    return ctx;
}
