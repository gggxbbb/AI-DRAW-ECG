import { useECG } from '../lib/ECGContext';

export default function DisplayOptionsSection() {
    const { state, dispatch } = useECG();
    const { displayConfig } = state;

    const updateDisplay = (key, value) => {
        const newDisplay = { ...displayConfig, [key]: value };
        dispatch({ type: 'SET_DISPLAY_CONFIG', payload: { [key]: value } });
    };

    return (
        <section className="panel-section">
            <h2 className="section-title">显示选项</h2>
            <div className="form-row">
                <label className="checkbox-label">
                    <input type="checkbox" checked={displayConfig.showGrid}
                        onChange={e => updateDisplay('showGrid', e.target.checked)} /> 网格
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" checked={displayConfig.showLabels}
                        onChange={e => updateDisplay('showLabels', e.target.checked)} /> 标注
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" checked={displayConfig.showAnnotations}
                        onChange={e => updateDisplay('showAnnotations', e.target.checked)} /> 特征标记
                </label>
            </div>
        </section>
    );
}
