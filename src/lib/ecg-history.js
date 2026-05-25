const STORAGE_KEY = 'ecg-history';

export function loadHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

export function saveHistory(records) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch (e) {
        // localStorage full - remove oldest entries
        const trimmed = records.slice(-50);
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch (_) {}
    }
}

export function addHistoryRecord(record) {
    const history = loadHistory();
    // Find and overwrite if same id, otherwise push
    const idx = history.findIndex(r => r.id === record.id);
    if (idx >= 0) {
        history[idx] = record;
    } else {
        history.push(record);
    }
    saveHistory(history);
    return history;
}

export function deleteHistoryRecord(id) {
    const history = loadHistory().filter(r => r.id !== id);
    saveHistory(history);
    return history;
}

export function clearHistory() {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
}

export function buildHistoryRecord(id, condition, additionalParams, state, renderer) {
    return {
        id,
        timestamp: new Date().toISOString(),
        condition: condition || '',
        additionalParams: additionalParams || '',
        headerInfo: state.headerInfo,
        currentParams: state.currentParams ? { ...state.currentParams } : null,
        displayConfig: { ...state.displayConfig },
        programmaticAnalysis: state.programmaticAnalysis ? { ...state.programmaticAnalysis } : null,
        aiInterpretation: state.aiInterpretation,
        aiLeadDescriptions: state.aiLeadDescriptions ? { ...state.aiLeadDescriptions } : null,
        tokenUsage: state.tokenUsage ? { ...state.tokenUsage } : null,
        leadCurves: deepCopyCurves(renderer ? renderer.getAllCurves() : {}),
    };
}

function deepCopyCurves(curves) {
    const copy = {};
    for (const [lead, points] of Object.entries(curves)) {
        if (Array.isArray(points)) {
            copy[lead] = points.map(pt => [...pt]);
        }
    }
    return copy;
}
