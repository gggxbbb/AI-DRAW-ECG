import { useState } from 'react';
import { useECG } from '../lib/ECGContext';
import { buildHistoryRecord } from '../lib/ecg-history';

export default function HistoryPanel() {
    const { state, handleRestoreHistory, handleDeleteHistory, handleClearHistory, handleSaveToHistory, getRenderer } = useECG();
    const { history } = state;
    const [isOpen, setIsOpen] = useState(true);

    if (history.length === 0 && !isOpen) return null;

    const sectionClass = `panel-section collapsible${isOpen ? ' open' : ''}`;

    const formatDate = (iso) => {
        try {
            const d = new Date(iso);
            return d.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        } catch { return iso; }
    };

    const truncate = (text, len = 40) => {
        if (!text) return '';
        return text.length > len ? text.slice(0, len) + '...' : text;
    };

    const conclusionClass = (c) => {
        if (!c) return '';
        if (c.includes('未见明显异常')) return 'history-finding-normal';
        if (c.includes('多项异常')) return 'history-finding-critical';
        return 'history-finding-abnormal';
    };

    const handleSave = () => {
        const renderer = getRenderer();
        if (!renderer || !state.currentParams) return;
        const record = buildHistoryRecord(
            Date.now().toString(),
            state.headerInfo || '',
            '',
            state,
            renderer
        );
        handleSaveToHistory(record);
    };

    const hasCurrentResult = !!state.currentParams && !state.isGenerating;

    return (
        <section className={sectionClass}>
            <h2 className="section-title" onClick={() => setIsOpen(!isOpen)}>
                历史记录
                <span className="history-badge">{history.length}</span>
            </h2>
            {isOpen && (
                <div className="history-content">
                    {hasCurrentResult && (
                        <button className="history-save-btn" onClick={handleSave}>
                            保存当前结果
                        </button>
                    )}
                    {history.length === 0 ? (
                        <p className="history-empty">暂无历史记录，生成心电图后将自动保存</p>
                    ) : (
                        <>
                            <ul className="history-list">
                                {[...history].reverse().map((record) => (
                                    <li key={record.id} className="history-item">
                                        <div
                                            className="history-item-main"
                                            onClick={() => handleRestoreHistory(record)}
                                            title="点击恢复此记录"
                                        >
                                            <div className="history-item-header">
                                                <span className="history-date">{formatDate(record.timestamp)}</span>
                                                {record.programmaticAnalysis && (
                                                    <span className={`history-conclusion ${conclusionClass(record.programmaticAnalysis.conclusion)}`}>
                                                        {record.programmaticAnalysis.conclusion}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="history-condition">
                                                {truncate(record.condition, 60) || '（无描述）'}
                                            </div>
                                        </div>
                                        <button
                                            className="history-delete-btn"
                                            onClick={(e) => { e.stopPropagation(); handleDeleteHistory(record.id); }}
                                            title="删除"
                                        >
                                            x
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <div className="history-actions">
                                <button className="history-clear-btn" onClick={handleClearHistory}>
                                    清空全部
                                </button>
                            </div>
                        </>
                    )}
                </div>
            )}
        </section>
    );
}
