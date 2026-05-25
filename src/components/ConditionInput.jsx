import { useState } from 'react';
import { useECG } from '../lib/ECGContext';

export default function ConditionInput() {
    const { state, handleGenerateStream, addToast } = useECG();
    const [condition, setCondition] = useState('');
    const [additional, setAdditional] = useState('');
    const { isGenerating, aiConfig, progressBar, progressPhase, streamProgress } = state;

    const handleGenerateClick = async () => {
        if (!condition.trim()) {
            addToast('请输入生理病理描述', 'warning');
            return;
        }
        if (!aiConfig.endpoint || !aiConfig.token) {
            addToast('请先配置AI参数', 'warning');
            return;
        }
        await handleGenerateStream(condition, additional);
    };

    return (
        <section className="panel-section">
            <h2 className="section-title">生理病理描述</h2>
            <div className="form-group">
                <textarea id="conditionInput" rows="3"
                    placeholder={`描述疾病或生理状态，AI将生成12导联心电图...\n例：急性前壁心肌梗死、心房颤动、高钾血症...`}
                    value={condition}
                    onChange={e => setCondition(e.target.value)} />
            </div>
            <div className="form-group">
                <textarea id="additionalParams" rows="1"
                    placeholder="补充参数：心率、年龄、特殊要求...（可选）"
                    value={additional}
                    onChange={e => setAdditional(e.target.value)} />
            </div>
            <button type="button" className="btn btn-primary" id="generateBtn"
                onClick={handleGenerateClick}
                disabled={isGenerating}>
                {isGenerating ? (
                    <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:2}}>
                        <span><span className="spinner"></span> AI 生成中...</span>
                        {progressBar && <span style={{fontFamily:'monospace',fontSize:'0.68rem',opacity:0.85}}>{progressBar}{streamProgress ? ` (${streamProgress})` : ''}</span>}
                    </div>
                ) : (
                    <>&#9889; 生成心电图</>
                )}
            </button>
        </section>
    );
}
