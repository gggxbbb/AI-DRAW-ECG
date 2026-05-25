const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js';

class PyodideRuntime {
    constructor() {
        this._pyodide = null;
        this._loading = null;
        this.status = 'idle';
        this._listeners = [];
        this._executor = null;
        this._renderer = null;
    }

    get isReady() { return this.status === 'ready'; }
    get isLoading() { return this.status === 'loading'; }
    get isError() { return this.status === 'error'; }

    onChange(fn) {
        this._listeners.push(fn);
        return () => { this._listeners = this._listeners.filter(l => l !== fn); };
    }

    _setStatus(s) {
        this.status = s;
        for (const fn of this._listeners) fn(s);
    }

    setContext(executor, renderer) {
        this._executor = executor;
        this._renderer = renderer;
    }

    preload() {
        if (this.status !== 'idle') return;
        this._ensureLoaded();
    }

    async _ensureLoaded() {
        if (this._pyodide) return this._pyodide;
        if (this._loading) return this._loading;
        this._setStatus('loading');
        this._loading = this._doLoad();
        try {
            this._pyodide = await this._loading;
            this._setStatus('ready');
            return this._pyodide;
        } catch (err) {
            this._setStatus('error');
            throw err;
        } finally {
            this._loading = null;
        }
    }

    async _doLoad() {
        const existingScript = document.querySelector(`script[src="${PYODIDE_CDN}"]`);
        if (!existingScript) {
            const script = document.createElement('script');
            script.src = PYODIDE_CDN;
            await new Promise((resolve, reject) => {
                script.onload = resolve;
                script.onerror = () => reject(new Error('Pyodide CDN 加载失败'));
                document.head.appendChild(script);
            });
        }
        const pyodide = await globalThis.loadPyodide();
        await pyodide.loadPackage('numpy');
        return pyodide;
    }

    _injectBridge(pyodide) {
        const exec = this._executor;
        const rend = this._renderer;
        if (!exec || !rend) return;
        
        pyodide.runPython('_ecg_log = print');
        const pyPrint = (msg) => {
            try { return pyodide.globals.get('_ecg_log')(String(msg)); } catch (e) {}
        };

        const toJsArr = (proxy) => {
            if (!proxy) return [];
            try { return proxy.toJs(); } catch (e) { return []; }
        };

        const toJsObj = (proxy) => {
            if (!proxy) return {};
            try { return proxy.toJs(); } catch (e) { return {}; }
        };

        const VALID_LEADS = ['I','II','III','aVR','aVL','aVF','V1','V2','V3','V4','V5','V6'];

        pyodide.globals.set('ecg_init', (rhythmType, hr, qrsDuration, qtInterval, qrsAxis) => {
            let hR = 72, qD = 90, qT = 390, qA = 30;
            if (typeof hr === 'object' && hr !== null) {
                hR = hr.get('heart_rate') || hr.get('heartRate') || 72;
                qD = hr.get('qrs_duration') || hr.get('qrsDuration') || 90;
                qT = hr.get('qt_interval') || hr.get('qtInterval') || 390;
                qA = hr.get('qrs_axis') || hr.get('qrsAxis') || 30;
            } else {
                hR = hr || 72;
                qD = qrsDuration || 90;
                qT = qtInterval || 390;
                qA = qrsAxis || 30;
            }
            if (typeof rhythmType !== 'string') rhythmType = 'sinus';
            exec.storedParams = { heartRate: hR, qrsDuration: qD, qtInterval: qT, qrsAxis: qA, rhythmType };
            exec.leadCount = 0;
            exec.leadNames = [];
            exec.initDone = true;
            exec.rhythmDone = false;
            exec.interpDone = false;
            exec.descriptionsDone = false;
            exec.programmaticAnalysis = null;
            exec.headerInfo = null;
            exec.redrawRound = false;
            rend._headerText = null;
            rend.renderInit(exec.storedParams);
            const msg = `[ecg_init] 画布已初始化 | ${rhythmType} | HR=${hR}bpm QRS=${qD}ms QT=${qT}ms Axis=${qA}°`;
            pyPrint(msg);
            return msg;
        });

        pyodide.globals.set('ecg_set_header', (text) => {
            exec.headerInfo = String(text);
            if (rend._layout) rend.drawHeaderText(String(text));
            const msg = `[ecg_set_header] ${text}`;
            pyPrint(msg);
            return msg;
        });

        pyodide.globals.set('ecg_get_params', () => {
            const p = exec.storedParams || {};
            return pyodide.toPy(Object.assign({}, p));
        });

        pyodide.globals.set('ecg_draw_lead', (lead, pointsProxy) => {
            if (!exec.initDone) {
                const msg = '[ecg_draw_lead] ERROR: 请先调用 ecg_init';
                pyPrint(msg); return msg;
            }
            const leadStr = String(lead);
            if (!VALID_LEADS.includes(leadStr)) {
                const msg = `[ecg_draw_lead] ERROR: 无效导联名 '${leadStr}'`;
                pyPrint(msg); return msg;
            }
            let pts;
            try { pts = toJsArr(pointsProxy); } catch (e) {
                const msg = `[ecg_draw_lead] ERROR: ${leadStr} 数据解析失败 - ${e.message}`;
                pyPrint(msg); return msg;
            }
            if (!pts || pts.length < 4) {
                const msg = `[ecg_draw_lead] ERROR: ${leadStr} 数据点不足 (${pts ? pts.length : 0})`;
                pyPrint(msg); return msg;
            }
            rend.renderLeadCurveCSV(leadStr, pts, exec.storedParams);
            const isRedraw = exec.leadNames.includes(leadStr);
            if (!isRedraw) {
                exec.leadCount++;
                exec.leadNames.push(leadStr);
            }
            const label = isRedraw ? ' (重绘)' : '';
            const curve = rend._leadCurves[leadStr] || [];
            const msg = `[ecg_draw_lead] ${leadStr}${label} | ${pts.length}点 → ${curve.length}平滑点 | ${exec.leadCount}/12 导联完成`;
            pyPrint(msg);
            return msg;
        });

        pyodide.globals.set('ecg_draw_cycle', (lead, pointsProxy) => {
            if (!exec.initDone) {
                const msg = '[ecg_draw_cycle] ERROR: 请先调用 ecg_init';
                pyPrint(msg); return msg;
            }
            const leadStr = String(lead);
            if (!VALID_LEADS.includes(leadStr)) {
                const msg = `[ecg_draw_cycle] ERROR: 无效导联名 '${leadStr}'`;
                pyPrint(msg); return msg;
            }
            let pts;
            try { pts = toJsArr(pointsProxy); } catch (e) {
                const msg = `[ecg_draw_cycle] ERROR: ${leadStr} 数据解析失败 - ${e.message}`;
                pyPrint(msg); return msg;
            }
            if (!pts || pts.length < 4) {
                const msg = `[ecg_draw_cycle] ERROR: ${leadStr} 数据点不足 (${pts ? pts.length : 0})`;
                pyPrint(msg); return msg;
            }
            rend.renderLeadCurveCycle(leadStr, pts, exec.storedParams);
            if (!exec.leadNames.includes(leadStr)) {
                exec.leadCount++;
                exec.leadNames.push(leadStr);
            }
            const curve = rend._leadCurves[leadStr] || [];
            const msg = `[ecg_draw_cycle] ${leadStr} | ${pts.length}点/循环 → ${curve.length}平滑点 | ${exec.leadCount}/12 导联完成`;
            pyPrint(msg);
            return msg;
        });

        pyodide.globals.set('ecg_draw_all', (leadsProxy) => {
            if (!exec.initDone) {
                const msg = '[ecg_draw_all] ERROR: 请先调用 ecg_init';
                pyPrint(msg); return msg;
            }
            const drawn = [];
            const errors = [];
            try {
                for (const lead of leadsProxy) {
                    const leadStr = String(lead);
                    if (!leadStr || !VALID_LEADS.includes(leadStr)) {
                        errors.push(`无效导联: '${leadStr}'`);
                        continue;
                    }
                    const pointsProxy = leadsProxy.get(lead);
                    if (!pointsProxy) {
                        errors.push(`${leadStr}: 未获取到数据`);
                        continue;
                    }
                    let pts;
                    try {
                        pts = toJsArr(pointsProxy);
                    } catch (e) {
                        errors.push(`${leadStr}: 数据解析失败`);
                        continue;
                    }
                    if (!pts || pts.length < 4) {
                        errors.push(`${leadStr}: 数据点不足 (${pts ? pts.length : 0})`);
                        continue;
                    }
                    rend.renderLeadCurveCSV(leadStr, pts, exec.storedParams);
                    if (!exec.leadNames.includes(leadStr)) {
                        exec.leadCount++;
                        exec.leadNames.push(leadStr);
                    }
                    drawn.push(leadStr);
                }
            } catch (e) {
                const msg = `[ecg_draw_all] ERROR: 遍历失败 - ${e.message}`;
                pyPrint(msg);
                return msg;
            }
            const msg = `[ecg_draw_all] 完成 ${drawn.length}/12 导联: ${drawn.join(', ')}` +
                (errors.length ? ` | 错误: ${errors.join('; ')}` : '');
            pyPrint(msg);
            return msg;
        });

        pyodide.globals.set('ecg_draw_rhythm', (lead) => {
            if (exec.leadCount < 12) {
                const msg = `[ecg_draw_rhythm] ERROR: 仅完成 ${exec.leadCount}/12 导联`;
                pyPrint(msg); return msg;
            }
            const leadStr = String(lead || 'II');
            rend.renderRhythmCurve(leadStr, exec.storedParams);
            exec.rhythmDone = true;
            const msg = `[ecg_draw_rhythm] ${leadStr} 节律带已绘制`;
            pyPrint(msg);
            return msg;
        });
    }

    _cleanupBridge(pyodide) {
        try {
            const names = ['ecg_init','ecg_draw_lead','ecg_draw_cycle','ecg_draw_all','ecg_draw_rhythm','ecg_set_header','ecg_get_params','_ecg_log'];
            for (const n of names) {
                pyodide.globals.delete(n);
            }
        } catch (e) {}
    }

    async run(code) {
        const pyodide = await this._ensureLoaded();
        await pyodide.runPythonAsync(`
import sys
import io
_sys_stdout = sys.stdout
_io_capture = io.StringIO()
sys.stdout = _io_capture
`);

        this._injectBridge(pyodide);

        let stdout = '';
        let stderr = '';
        try {
            await pyodide.runPythonAsync(code);
        } catch (err) {
            stderr = err.message || String(err);
        } finally {
            this._cleanupBridge(pyodide);
            await pyodide.runPythonAsync(`
sys.stdout = _sys_stdout
__result__ = _io_capture.getvalue()
`);
            stdout = pyodide.globals.get('__result__') || '';
            pyodide.globals.delete('__result__');
            await pyodide.runPythonAsync(`
del _sys_stdout, _io_capture
`);
            if (stderr) {
                await pyodide.runPythonAsync(`
import sys, io
sys.stderr = sys.__stderr__
`);
            }
        }
        return { success: !stderr, stdout: stdout.trimEnd(), stderr };
    }
}

export const pyodideRuntime = new PyodideRuntime();
