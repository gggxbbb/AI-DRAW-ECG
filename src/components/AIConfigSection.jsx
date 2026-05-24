import { useState } from 'react';
import { useECG } from '../lib/ECGContext';

export default function AIConfigSection() {
    const { state, dispatch, saveConfig, handleTestConnection } = useECG();
    const { aiConfig } = state;
    const [isOpen, setIsOpen] = useState(false);
    const [showToken, setShowToken] = useState(false);
    const [connStatus, setConnStatus] = useState({ text: '', className: '' });
    const [testing, setTesting] = useState(false);

    const sectionClass = `panel-section collapsible${isOpen ? ' open' : ''}`;

    const updateConfig = (key, value) => {
        const newConfig = { ...aiConfig, [key]: value };
        dispatch({ type: 'SET_AI_CONFIG', payload: { [key]: value } });
        saveConfig(newConfig);
    };

    const handleTest = async () => {
        if (!aiConfig.endpoint || !aiConfig.token) {
            setConnStatus({ text: '请填写API Endpoint和Token', className: 'status-error' });
            return;
        }
        setTesting(true);
        setConnStatus({ text: '', className: '' });
        const result = await handleTestConnection(
            aiConfig.endpoint, aiConfig.token, aiConfig.model, aiConfig.temperature
        );
        if (result.success) {
            setConnStatus({ text: `已连接 (${result.model})`, className: 'status-success' });
        } else {
            setConnStatus({ text: result.message, className: 'status-error' });
        }
        setTesting(false);
    };

    return (
        <section className={sectionClass} id="aiConfigSection">
            <h2 className="section-title" onClick={() => setIsOpen(!isOpen)}>
                <span className="collapse-arrow">&#9654;</span>
                AI 配置
            </h2>
            <div className={`collapsible-body${isOpen ? ' expanded' : ' collapsed'}`} id="aiConfigBody">
                <div className="form-group">
                    <label htmlFor="apiEndpoint">API Endpoint</label>
                    <input type="url" id="apiEndpoint"
                        placeholder="https://api.openai.com/v1/chat/completions"
                        value={aiConfig.endpoint}
                        onChange={e => updateConfig('endpoint', e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="apiToken">API Token</label>
                    <div className="password-wrapper">
                        <input
                            type={showToken ? 'text' : 'password'}
                            id="apiToken"
                            placeholder="sk-..."
                            value={aiConfig.token}
                            onChange={e => updateConfig('token', e.target.value)} />
                        <button type="button" className="toggle-password" title="显示/隐藏Token"
                            onClick={() => setShowToken(!showToken)}>&#128065;</button>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="modelName">Model Name</label>
                    <input type="text" id="modelName"
                        placeholder="gpt-4o / deepseek-chat / claude-3-opus..."
                        value={aiConfig.model}
                        onChange={e => updateConfig('model', e.target.value)} />
                </div>
                <div className="form-group">
                    <label htmlFor="temperature">Temperature</label>
                    <div className="range-row">
                        <input type="range" id="temperature" min="0" max="2" step="0.1"
                            value={aiConfig.temperature}
                            onChange={e => updateConfig('temperature', parseFloat(e.target.value))} />
                        <span className="range-value" id="tempValue">{aiConfig.temperature}</span>
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="reasoningEffort">推理强度（推理模型专用）</label>
                    <select id="reasoningEffort"
                        value={aiConfig.reasoningEffort || ''}
                        onChange={e => updateConfig('reasoningEffort', e.target.value)}>
                        <option value="">默认</option>
                        <option value="low">低</option>
                        <option value="medium">中</option>
                        <option value="high">高</option>
                    </select>
                </div>
                <button type="button" className="btn btn-outline btn-sm-full"
                    onClick={handleTest} disabled={testing}>
                    {testing ? '测试中...' : '测试连接'}
                </button>
                {connStatus.text && (
                    <span className={`status-text ${connStatus.className} connection-status`}>
                        {connStatus.text}
                    </span>
                )}
            </div>
        </section>
    );
}
