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
            <div className="form-group">
                <label>走纸速度</label>
                <div className="btn-group">
                    {[25, 50, 12.5].map(speed => (
                        <button key={speed}
                            className={`btn-option${displayConfig.paperSpeed === speed ? ' active' : ''}`}
                            onClick={() => updateDisplay('paperSpeed', speed)}>
                            {speed} mm/s
                        </button>
                    ))}
                </div>
            </div>
            <div className="form-group">
                <label>增益</label>
                <div className="btn-group">
                    {[10, 20, 5].map(gain => (
                        <button key={gain}
                            className={`btn-option${displayConfig.gain === gain ? ' active' : ''}`}
                            onClick={() => updateDisplay('gain', gain)}>
                            {gain} mm/mV
                        </button>
                    ))}
                </div>
            </div>
            <div className="form-row">
                <label className="checkbox-label">
                    <input type="checkbox" checked={displayConfig.showGrid}
                        onChange={e => updateDisplay('showGrid', e.target.checked)} /> 网格
                </label>
                <label className="checkbox-label">
                    <input type="checkbox" checked={displayConfig.showLabels}
                        onChange={e => updateDisplay('showLabels', e.target.checked)} /> 标注
                </label>
            </div>
        </section>
    );
}
