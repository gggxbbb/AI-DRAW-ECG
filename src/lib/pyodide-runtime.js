const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.29.4/full/pyodide.js';

class PyodideRuntime {
    constructor() {
        this._pyodide = null;
        this._loading = null;
        this.status = 'idle';
        this._listeners = [];
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

    async run(code) {
        const pyodide = await this._ensureLoaded();
        await pyodide.runPythonAsync(`
import sys
import io
_sys_stdout = sys.stdout
_io_capture = io.StringIO()
sys.stdout = _io_capture
`);
        let stdout = '';
        let stderr = '';
        try {
            await pyodide.runPythonAsync(code);
        } catch (err) {
            stderr = err.message || String(err);
        } finally {
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
