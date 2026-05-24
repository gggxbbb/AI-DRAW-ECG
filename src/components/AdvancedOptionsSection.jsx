import { useState, useCallback } from 'react';
import { useECG } from '../lib/ECGContext';

const RHYTHM_OPTIONS = [
    { value: '', label: '自动' },
    { value: 'sinus', label: '窦性' },
    { value: 'atrial_fibrillation', label: '房颤' },
    { value: 'atrial_flutter', label: '房扑' },
    { value: 'ventricular', label: '室性' },
    { value: 'paced', label: '起搏' },
    { value: 'complete_heart_block', label: '三度AVB' },
    { value: 'sinus_with_pvc', label: '窦性+室早' },
    { value: 'sinus_arrhythmia', label: '窦性不齐' },
    { value: 'sinus_with_wenckebach', label: '文氏' },
    { value: 'sinus_with_mobitz2', label: 'Mobitz II' },
    { value: 'torsades', label: '尖端扭转' },
    { value: 'ventricular_fibrillation', label: '室颤' },
];

const ST_SHAPE_OPTIONS = [
    { value: '', label: '自动' },
    { value: 'flat', label: '平坦' },
    { value: 'coved_upward', label: '穹窿型' },
    { value: 'concave_upward', label: '凹面向上' },
    { value: 'horizontal_depression', label: '水平压低' },
];

const T_WAVE_OPTIONS = [
    { value: '', label: '自动' },
    { value: 'asymmetric', label: '不对称(正常)' },
    { value: 'symmetric_peaked', label: '对称高尖' },
    { value: 'peaked_symmetric_tented', label: '帐篷状(高钾)' },
    { value: 'symmetric_deep_inverted', label: '深倒置' },
    { value: 'opposite_qrs', label: '与QRS反向' },
    { value: 'lv_strain', label: '左室劳损' },
    { value: 'rv_strain', label: '右室劳损' },
    { value: 'flat_u_wave', label: '低平+U波' },
    { value: 'brugada_inverted', label: 'Brugada倒置' },
    { value: 'broad_biphasic_notched', label: '宽大双峰' },
];

export default function AdvancedOptionsSection() {
    const { state, dispatch, getRenderer, addToast } = useECG();
    const { currentParams } = state;
    const [isOpen, setIsOpen] = useState(false);

    const syncFromParams = useCallback((params) => {
        if (!params) return;
        // Returns initial values based on current params
        return {
            heartRate: params.heartRate ?? '',
            prInterval: params.prInterval ?? '',
            qrsDuration: params.qrsDuration ?? '',
            qtInterval: params.qtInterval ?? '',
            pAmplitude: params.pAmplitude ?? '',
            qrsAmplitude: params.qrsAmplitude ?? '',
            tAmplitude: params.tAmplitude ?? '',
            qrsAxis: params.qrsAxis ?? params.axis ?? '',
            pAxis: params.pAxis ?? '',
            tAxis: params.tAxis ?? '',
            stElevation: params.stElevation ?? '',
            stDepression: params.stDepression ?? '',
            rhythmType: params.rhythmType ?? '',
            stShape: params.stShape ?? '',
            twaveShape: params.twaveShape ?? '',
        };
    }, []);

    const getNum = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = el.value;
        return v !== '' ? parseFloat(v) : null;
    };
    const getStr = (id) => {
        const el = document.getElementById(id);
        return el?.value || null;
    };
    const getChk = (id) => {
        const el = document.getElementById(id);
        return el?.checked || false;
    };

    const applyAdvanced = () => {
        if (!currentParams) {
            addToast('请先生成或选择心电图模板', 'warning');
            return;
        }

        const p = { ...currentParams };
        const applyIf = (key, id) => { const val = getNum(id); if (val !== null) p[key] = val; };

        applyIf('heartRate', 'advHeartRate');
        applyIf('prInterval', 'advPR');
        applyIf('qrsDuration', 'advQRSDur');
        applyIf('qtInterval', 'advQT');
        applyIf('pAmplitude', 'advPAmp');
        applyIf('qrsAmplitude', 'advQrsAmp');
        applyIf('tAmplitude', 'advTAmp');
        applyIf('qrsAxis', 'advQrsAxis');
        applyIf('pAxis', 'advPAxis');
        applyIf('tAxis', 'advTAxis');
        applyIf('stElevation', 'advSTElev');
        applyIf('stDepression', 'advSTDep');

        const rhythmVal = getStr('advRhythmType');
        if (rhythmVal) p.rhythmType = rhythmVal;

        const stVal = getStr('advSTShape');
        if (stVal) { p.stShape = stVal; if (['flat','upsloping','downsloping','horizontal'].includes(stVal)) p.stSlope = stVal; }

        const tVal = getStr('advTWaveShape');
        if (tVal) p.twaveShape = tVal;

        p.tInverted = getChk('advTInverted') || null;
        p.tPeaked = getChk('advTPeaked') || null;
        p.tFlattened = getChk('advTFlat') || null;
        if (getChk('advQWave')) { if (!p.qWave) p.qWave = { depth: 0.25, duration: 0.04, leads: ['II','III','aVF'] }; }
        else p.qWave = null;
        p.uWavePresent = getChk('advUWave') || null;
        p.uWaveProminent = getChk('advUWave');
        if (getChk('advQrsWide')) p.qrsDuration = Math.max(p.qrsDuration || 90, 125);
        p.rbbbRsrPattern = getChk('advRbbb') || null;
        if (getChk('advPaced')) { p.rhythmType = 'paced'; p.pPresent = false; if (!p.paceSpike) p.paceSpike = { amplitude: 0.3, duration: 2 }; }
        p.qrsNotching = getChk('advQrsNotch') || null;
        p.stDiscordant = getChk('advStDiscordant') || null;

        dispatch({ type: 'SET_PARAMS', payload: p });
        const renderer = getRenderer();
        if (renderer) {
            renderer.setPaperSpeed(state.displayConfig.paperSpeed);
            renderer.setGain(state.displayConfig.gain);
            renderer.setGrid(state.displayConfig.showGrid);
            renderer.setLabels(state.displayConfig.showLabels);
            renderer.render(p);
        }
        dispatch({ type: 'SET_STATUS', payload: { text: '参数已应用（手动调整）', className: 'status-template' } });
        addToast('参数已应用', 'success');
    };

    const sectionClass = `panel-section collapsible${isOpen ? ' open' : ''}`;
    const defaults = syncFromParams(currentParams || {});

    return (
        <section className={sectionClass} id="advancedSection">
            <h2 className="section-title" onClick={() => setIsOpen(!isOpen)}>
                <span className="collapse-arrow">&#9654;</span>
                高级选项（手动调参）
            </h2>
            <div className={`collapsible-body${isOpen ? ' expanded' : ' collapsed'}`} id="advancedBody">
                <div className="adv-grid">
                    <div className="adv-field">
                        <label>心率 (bpm)</label>
                        <input type="number" id="advHeartRate" min="20" max="300" step="1" placeholder="72"
                            defaultValue={defaults.heartRate} />
                    </div>
                    <div className="adv-field">
                        <label>节律类型</label>
                        <select id="advRhythmType" defaultValue={defaults.rhythmType}>
                            {RHYTHM_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="adv-field">
                        <label>PR间期 (ms)</label>
                        <input type="number" id="advPR" min="0" max="500" step="5" placeholder="160"
                            defaultValue={defaults.prInterval} />
                    </div>
                    <div className="adv-field">
                        <label>QRS时限 (ms)</label>
                        <input type="number" id="advQRSDur" min="40" max="250" step="5" placeholder="90"
                            defaultValue={defaults.qrsDuration} />
                    </div>
                    <div className="adv-field">
                        <label>QT间期 (ms)</label>
                        <input type="number" id="advQT" min="200" max="700" step="5" placeholder="390"
                            defaultValue={defaults.qtInterval} />
                    </div>
                    <div className="adv-field">
                        <label>QRS电轴 (°)</label>
                        <input type="number" id="advQrsAxis" min="-180" max="180" step="5" placeholder="30"
                            defaultValue={defaults.qrsAxis} />
                    </div>
                    <div className="adv-field">
                        <label>P波振幅 (mV)</label>
                        <input type="number" id="advPAmp" min="0" max="1" step="0.05" placeholder="0.15"
                            defaultValue={defaults.pAmplitude} />
                    </div>
                    <div className="adv-field">
                        <label>QRS振幅 (mV)</label>
                        <input type="number" id="advQrsAmp" min="0.1" max="5" step="0.1" placeholder="1.5"
                            defaultValue={defaults.qrsAmplitude} />
                    </div>
                    <div className="adv-field">
                        <label>T波振幅 (mV)</label>
                        <input type="number" id="advTAmp" min="0" max="2" step="0.05" placeholder="0.3"
                            defaultValue={defaults.tAmplitude} />
                    </div>
                    <div className="adv-field">
                        <label>P波电轴 (°)</label>
                        <input type="number" id="advPAxis" min="-180" max="180" step="5" placeholder="50"
                            defaultValue={defaults.pAxis} />
                    </div>
                    <div className="adv-field">
                        <label>ST抬高 (mV)</label>
                        <input type="number" id="advSTElev" min="0" max="1" step="0.05" placeholder="0"
                            defaultValue={defaults.stElevation} />
                    </div>
                    <div className="adv-field">
                        <label>ST压低 (mV)</label>
                        <input type="number" id="advSTDep" min="-1" max="0" step="0.05" placeholder="0"
                            defaultValue={defaults.stDepression} />
                    </div>
                    <div className="adv-field">
                        <label>T波电轴 (°)</label>
                        <input type="number" id="advTAxis" min="-180" max="180" step="5" placeholder="40"
                            defaultValue={defaults.tAxis} />
                    </div>
                    <div className="adv-field">
                        <label>ST段形态</label>
                        <select id="advSTShape" defaultValue={defaults.stShape}>
                            {ST_SHAPE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="adv-field">
                        <label>T波形态</label>
                        <select id="advTWaveShape" defaultValue={defaults.twaveShape}>
                            {T_WAVE_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="adv-checks">
                    <label className="checkbox-label"><input type="checkbox" id="advTInverted" /> T波倒置</label>
                    <label className="checkbox-label"><input type="checkbox" id="advTPeaked" /> T波高尖</label>
                    <label className="checkbox-label"><input type="checkbox" id="advTFlat" /> T波低平</label>
                    <label className="checkbox-label"><input type="checkbox" id="advQWave" /> 病理性Q波</label>
                    <label className="checkbox-label"><input type="checkbox" id="advUWave" /> U波明显</label>
                    <label className="checkbox-label"><input type="checkbox" id="advQrsWide" /> QRS增宽(LBBB/RBBB)</label>
                    <label className="checkbox-label"><input type="checkbox" id="advRbbb" /> RBBB形态</label>
                    <label className="checkbox-label"><input type="checkbox" id="advPaced" /> 起搏信号</label>
                    <label className="checkbox-label"><input type="checkbox" id="advQrsNotch" /> R波切迹</label>
                    <label className="checkbox-label"><input type="checkbox" id="advStDiscordant" /> 继发性ST-T</label>
                </div>
                <button type="button" className="btn btn-outline btn-sm-full" style={{marginTop: 6}}
                    onClick={applyAdvanced}>
                    应用参数
                </button>
            </div>
        </section>
    );
}
