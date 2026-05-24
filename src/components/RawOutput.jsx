import { useState, useEffect, useRef } from 'react';
import { useECG } from '../lib/ECGContext';

export default function RawOutput() {
    const { state } = useECG();
    const { rawReasoning, progressBar, streamProgress, isGenerating } = state;
    const [open, setOpen] = useState(true);
    const ref = useRef(null);

    useEffect(() => {
        if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
    }, [rawReasoning]);

    const hasContent = rawReasoning || progressBar || isGenerating;
    if (!hasContent) return null;

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
                            fontFamily: 'monospace', fontSize: '0.72rem',
                            padding: '4px 6px', background: '#f0f8ff',
                            borderRadius: 4, marginBottom: 4
                        }}>
                            <div style={{marginBottom: 2, color: '#333'}}>{progressBar} {streamProgress}</div>
                        </div>
                    )}
                    <div ref={ref} style={{
                        maxHeight: 240, overflow: 'auto',
                        background: '#1e1e1e', color: '#d4d4d4',
                        fontFamily: '"Courier New", monospace',
                        fontSize: '0.65rem', padding: 6, borderRadius: 4,
                        whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.5
                    }}>
                        {rawReasoning || (isGenerating && <span style={{color:'#666'}}>等待推理...</span>)}
                    </div>
                </>
            )}
        </section>
    );
}
