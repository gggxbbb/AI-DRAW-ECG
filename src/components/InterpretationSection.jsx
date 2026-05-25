import { useState } from 'react';
import { useECG } from '../lib/ECGContext';

export default function InterpretationSection() {
    const { state } = useECG();
    const { programmaticAnalysis, aiInterpretation, aiLeadDescriptions, currentParams, headerInfo } = state;
    const [showLeads, setShowLeads] = useState(false);

    if (!currentParams && !programmaticAnalysis && !headerInfo) return null;

    const prog = programmaticAnalysis;
    const leadNames = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];

    return (
        <section className="panel-section">
            {headerInfo && (
                <div style={{
                    background: '#f5f0e8', borderLeft: '3px solid #8b7355',
                    padding: '6px 10px', borderRadius: '0 4px 4px 0',
                    marginBottom: 10, fontSize: '0.78rem', fontWeight: 500,
                    color: '#4a3728', lineHeight: 1.5
                }}>
                    {headerInfo}
                </div>
            )}
            {prog && (
                <>
                    <h2 className="section-title">程序分析</h2>
                    <div className="interpretation-box">
                        <div className="interpret-tag" style={{
                            background: prog.conclusion.includes('危急') ? '#e74c3c' :
                                        prog.conclusion.includes('异常') ? '#e67e22' : '#27ae60',
                            color: '#fff', padding: '2px 8px', borderRadius: 3,
                            display: 'inline-block', fontSize: '0.75rem', fontWeight: 600, marginBottom: 4
                        }}>
                            {prog.conclusion}
                        </div>
                        <div style={{display: 'flex', flexWrap: 'wrap', gap: '2px 10px', marginBottom: 4}}>
                            {prog.measurements.filter(m => m && m.label).map((m, i) => (
                                <span key={i} style={{fontSize: '0.72rem', color: '#5a6c7a'}}>
                                    {m.label}: <strong>{m.value}</strong>
                                    {m.flag ? <span style={{color: '#e74c3c', fontSize: '0.68rem'}}> {m.flag}</span> : null}
                                </span>
                            ))}
                        </div>
                        {prog.findings.length > 0 && (
                            <div>
                                {prog.findings.filter(f => f && f.text).map((f, i) => (
                                    <div key={i} className={`int-item ${f.severity}`}
                                        style={{fontSize: '0.73rem'}}>{f.text}</div>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}

            {aiInterpretation && (
                <div style={{marginTop: prog ? 10 : 0}}>
                    <h2 className="section-title">AI 临床解读</h2>
                    <div className="interpretation-box" style={{lineHeight: 1.6, fontSize: '0.76rem'}}>
                        {aiInterpretation}
                    </div>
                </div>
            )}

            {aiLeadDescriptions && (
                <div style={{marginTop: 10}}>
                    <h2 className="section-title" style={{cursor: 'pointer'}}
                        onClick={() => setShowLeads(!showLeads)}>
                        <span className="collapse-arrow" style={{
                            display: 'inline-block', transform: showLeads ? 'rotate(90deg)' : 'none',
                            transition: 'transform 0.2s', fontSize: '0.65rem', width: 12
                        }}>&#9654;</span>
                        AI 导联描述
                    </h2>
                    {showLeads && (
                        <div className="interpretation-box" style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 8px'
                        }}>
                            {leadNames.filter(l => aiLeadDescriptions[l]).map(lead => (
                                <div key={lead} style={{fontSize: '0.7rem'}}>
                                    <strong>{lead}</strong>: {aiLeadDescriptions[lead]}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
