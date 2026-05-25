import { useState, useEffect, useRef, useMemo } from 'react';
import { useECG } from '../lib/ECGContext';

const CATEGORY_STYLES = {
    '推理': { color: '#e0c878', label: '推理', icon: '\u{1F9E0}' },
    '工具': { color: '#98c379', label: '工具', icon: '\u{1F527}' },
    '状态': { color: '#7eb8da', label: '状态', icon: '\u{1F4CB}' },
    '错误': { color: '#e06c75', label: '错误', icon: '\u2717' },
    '警告': { color: '#e5c07b', label: '警告', icon: '\u26A0' },
    '修正': { color: '#c678dd', label: '修正', icon: '\u{1F504}' },
};

function parseWithCategories(raw) {
    if (!raw) return [];
    const segments = [];
    const re = /\[(\/)?(推理|工具|状态|错误|警告|修正)\]/g;
    let lastIdx = 0;
    let currentCat = null;
    let catStart = -1;
    let match;

    while ((match = re.exec(raw)) !== null) {
        const isClose = match[1] === '/';
        const cat = match[2];
        const pos = match.index;

        if (isClose) {
            if (currentCat === cat && catStart >= 0) {
                segments.push({ category: cat, text: raw.slice(catStart, pos) });
                currentCat = null;
                catStart = -1;
                lastIdx = pos + match[0].length;
            }
        } else {
            if (lastIdx < pos) {
                segments.push({ category: null, text: raw.slice(lastIdx, pos) });
            }
            if (currentCat && catStart >= 0) {
                segments.push({ category: currentCat, text: raw.slice(catStart, pos) });
            }
            currentCat = cat;
            catStart = pos + match[0].length;
            lastIdx = catStart;
        }
    }

    if (lastIdx < raw.length) {
        if (currentCat) {
            segments.push({ category: currentCat, text: raw.slice(lastIdx) });
        } else {
            segments.push({ category: null, text: raw.slice(lastIdx) });
        }
    }
    if (segments.length === 0 && raw) {
        segments.push({ category: null, text: raw });
    }
    return segments;
}

export default function RawOutput() {
    const { state } = useECG();
    const { rawReasoning, progressBar, progressPhase, streamProgress, isGenerating, tokenUsage } = state;
    const [open, setOpen] = useState(true);
    const ref = useRef(null);

    const segments = useMemo(() => parseWithCategories(rawReasoning), [rawReasoning]);

    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [rawReasoning]);

    const hasContent = rawReasoning || progressBar || isGenerating;
    if (!hasContent) return null;

    const phaseIcons = { init: '\u2699', leads: '\u{1F4C8}', rhythm: '\u{1F3B5}', analysis: '\u{1F50D}', redraw: '\u{1F504}', interp: '\u{1F4DD}', desc: '\u{1F4CB}', done: '\u2713' };

    return (
        <section className="panel-section">
            <h2 className="section-title" style={{cursor: 'pointer'}} onClick={() => setOpen(!open)}>
                <span style={{display:'inline-block',transform:open?'rotate(90deg)':'none',transition:'transform 0.2s',fontSize:'0.65rem',width:12}}>&#9654;</span>
                AI 思考过程 {isGenerating && <span className="spinner" style={{width:10,height:10,borderWidth:1.5}}/>}
            </h2>
            {open && (
                <>
                    {progressBar && (
                        <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            fontFamily: 'monospace', fontSize: '0.72rem',
                            padding: '6px 10px', background: '#f0f8ff',
                            borderRadius: 4, marginBottom: 4
                        }}>
                            <span style={{fontSize:'0.85rem'}}>{phaseIcons[progressPhase] || '\u25C9'}</span>
                            <span style={{color:'#333',fontWeight:500}}>{progressBar}</span>
                            {streamProgress && <span style={{color:'#888'}}>{streamProgress}</span>}
                        </div>
                    )}
                    {tokenUsage && tokenUsage.total > 0 && (
                        <div style={{
                            fontFamily: 'monospace', fontSize: '0.62rem',
                            padding: '3px 8px', color: '#888',
                            textAlign: 'right', marginBottom: 4
                        }}>
                            累计消耗 token：{tokenUsage.total.toLocaleString()}
                            （输入 {tokenUsage.prompt.toLocaleString()} + 输出 {tokenUsage.completion.toLocaleString()}）
                        </div>
                    )}
                    <div ref={ref} style={{
                        maxHeight: 300, overflow: 'auto',
                        background: '#1e1e1e', color: '#d4d4d4',
                        fontFamily: '"Courier New", monospace',
                        fontSize: '0.65rem', padding: '6px 8px', borderRadius: 4,
                        lineHeight: 1.5
                    }}>
                        {segments.length > 0 ? (
                            segments.map((seg, i) => {
                                if (seg.category && CATEGORY_STYLES[seg.category]) {
                                    const s = CATEGORY_STYLES[seg.category];
                                    return (
                                        <div key={i} style={{
                                            borderLeft: `2px solid ${s.color}`,
                                            paddingLeft: 6, margin: '3px 0',
                                            color: s.color
                                        }}>
                                            <span style={{opacity:0.7,fontSize:'0.6rem'}}>{s.icon} {s.label}</span>
                                            <span style={{whiteSpace:'pre-wrap',wordBreak:'break-word',display:'block'}}>{seg.text}</span>
                                        </div>
                                    );
                                }
                                return <span key={i} style={{whiteSpace:'pre-wrap',wordBreak:'break-word',color:'#888'}}>{seg.text}</span>;
                            })
                        ) : (
                            isGenerating && <span style={{color:'#666'}}>等待推理...</span>
                        )}
                    </div>
                </>
            )}
        </section>
    );
}
