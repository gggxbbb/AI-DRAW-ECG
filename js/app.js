// Main Application - 12-Lead ECG Generator
(function () {
    'use strict';

    const state = {
        aiConfig: { endpoint: '', token: '', model: 'gpt-4o', temperature: 0.3 },
        displayConfig: { paperSpeed: 25, gain: 10, showGrid: true, showLabels: true },
        currentParams: null,
        isGenerating: false,
    };

    const canvas = document.getElementById('ecgCanvas');
    const renderer = new ECGRenderer(canvas);
    const aiClient = new AIClient();

    // ---- INIT ----
    function init() {
        loadConfig();
        renderTemplateChips();
        bindEvents();
        // Collapse AI config by default
        const body = document.getElementById('aiConfigBody');
        const section = document.getElementById('aiConfigSection');
        if (body) body.classList.add('collapsed');
        if (section) section.classList.remove('open');

        // Collapse advanced options by default
        const advBody = document.getElementById('advancedBody');
        const advSection = document.getElementById('advancedSection');
        if (advBody) advBody.classList.add('collapsed');
        if (advSection) advSection.classList.remove('open');
        updateCanvasSize();
    }

    function loadConfig() {
        try {
            const saved = localStorage.getItem('ecg-ai-config');
            if (saved) {
                const cfg = JSON.parse(saved);
                state.aiConfig = { ...state.aiConfig, ...cfg };
                document.getElementById('apiEndpoint').value = cfg.endpoint || '';
                document.getElementById('apiToken').value = cfg.token || '';
                document.getElementById('modelName').value = cfg.model || 'gpt-4o';
                document.getElementById('temperature').value = cfg.temperature;
                document.getElementById('tempValue').textContent = cfg.temperature;
                aiClient.configure(cfg.endpoint, cfg.token, cfg.model, cfg.temperature);
            }
        } catch (e) { /* ignore */ }
    }

    function saveConfig() {
        try { localStorage.setItem('ecg-ai-config', JSON.stringify(state.aiConfig)); }
        catch (e) { /* ignore */ }
    }

    function renderTemplateChips() {
        const container = document.getElementById('templateChips');
        if (!container) return;
        container.innerHTML = '';
        TEMPLATE_CATEGORIES.forEach(cat => {
            const grp = document.createElement('div');
            grp.className = 'template-group';
            grp.innerHTML = `<span class="template-category">${cat.name}</span>`;
            cat.templates.forEach(tId => {
                const tmpl = ECG_TEMPLATES[tId];
                if (!tmpl) return;
                const chip = document.createElement('span');
                chip.className = 'template-chip';
                chip.textContent = tmpl.name;
                chip.title = tmpl.description;
                chip.dataset.templateId = tId;
                chip.addEventListener('click', () => selectTemplate(tId));
                grp.appendChild(chip);
            });
            container.appendChild(grp);
        });
    }

    function selectTemplate(tId) {
        const tmpl = ECG_TEMPLATES[tId];
        if (!tmpl) return;
        document.getElementById('conditionInput').value = `${tmpl.name}\n${tmpl.description}`;
        document.getElementById('additionalParams').value = '';
        document.querySelectorAll('.template-chip').forEach(c => c.classList.remove('active'));
        const chip = document.querySelector(`[data-template-id="${tId}"]`);
        if (chip) chip.classList.add('active');
        renderFromTemplate(tmpl);
    }

    function renderFromTemplate(tmpl) {
        if (!tmpl || !tmpl.params) return;
        state.currentParams = { ...tmpl.params };
        const overlay = document.getElementById('placeholderOverlay');
        if (overlay) overlay.style.display = 'none';
        updateRendererConfig();
        renderer.render(state.currentParams);
        const statusEl = document.getElementById('ecgStatus');
        if (statusEl) {
            statusEl.textContent = `${tmpl.name} (内置模板)`;
            statusEl.className = 'status-text status-template';
        }
        syncAdvancedFields(state.currentParams);
    }

    // ---- EVENTS ----
    function bindEvents() {
        // Collapsible AI config
        const toggle = document.getElementById('aiConfigToggle');
        const body = document.getElementById('aiConfigBody');
        const section = document.getElementById('aiConfigSection');
        if (toggle && body) {
            toggle.addEventListener('click', () => {
                const isOpen = section.classList.contains('open');
                if (isOpen) {
                    body.classList.add('collapsed');
                    body.classList.remove('expanded');
                    section.classList.remove('open');
                } else {
                    body.classList.remove('collapsed');
                    body.classList.add('expanded');
                    section.classList.add('open');
                }
            });
        }

        // Collapsible advanced options
        const advToggle = document.getElementById('advancedToggle');
        const advBody = document.getElementById('advancedBody');
        const advSection = document.getElementById('advancedSection');
        if (advToggle && advBody) {
            advToggle.addEventListener('click', () => {
                const isOpen = advSection.classList.contains('open');
                if (isOpen) {
                    advBody.classList.add('collapsed');
                    advBody.classList.remove('expanded');
                    advSection.classList.remove('open');
                } else {
                    advBody.classList.remove('collapsed');
                    advBody.classList.add('expanded');
                    advSection.classList.add('open');
                }
            });
        }

        // Apply advanced options
        document.getElementById('applyAdvancedBtn').addEventListener('click', applyAdvancedOptions);

        // AI Config inputs
        document.getElementById('apiEndpoint').addEventListener('input', e => {
            state.aiConfig.endpoint = e.target.value; saveConfig();
        });
        document.getElementById('apiToken').addEventListener('input', e => {
            state.aiConfig.token = e.target.value; saveConfig();
        });
        document.getElementById('modelName').addEventListener('input', e => {
            state.aiConfig.model = e.target.value; saveConfig();
        });
        document.getElementById('temperature').addEventListener('input', e => {
            state.aiConfig.temperature = parseFloat(e.target.value);
            document.getElementById('tempValue').textContent = state.aiConfig.temperature;
            saveConfig();
        });

        // Toggle password visibility
        document.querySelector('.toggle-password').addEventListener('click', () => {
            const inp = document.getElementById('apiToken');
            inp.type = inp.type === 'password' ? 'text' : 'password';
        });

        // Test connection
        document.getElementById('testConnectionBtn').addEventListener('click', handleTestConnection);

        // Generate
        document.getElementById('generateBtn').addEventListener('click', handleGenerate);

        // Speed button group
        document.querySelectorAll('.btn-option[data-speed]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-option[data-speed]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.displayConfig.paperSpeed = parseInt(btn.dataset.speed);
                if (state.currentParams) {
                    updateRendererConfig();
                    renderer.render(state.currentParams);
                }
            });
        });

        // Gain button group
        document.querySelectorAll('.btn-option[data-gain]').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.btn-option[data-gain]').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.displayConfig.gain = parseInt(btn.dataset.gain);
                if (state.currentParams) {
                    updateRendererConfig();
                    renderer.render(state.currentParams);
                }
            });
        });

        // Grid & Labels checkboxes
        document.getElementById('showGrid').addEventListener('change', e => {
            state.displayConfig.showGrid = e.target.checked;
            if (state.currentParams) { updateRendererConfig(); renderer.render(state.currentParams); }
        });
        document.getElementById('showLabels').addEventListener('change', e => {
            state.displayConfig.showLabels = e.target.checked;
            if (state.currentParams) { updateRendererConfig(); renderer.render(state.currentParams); }
        });

        // Zoom
        document.getElementById('zoomInBtn').addEventListener('click', () => {
            renderer.setZoom(renderer.zoomLevel + 0.2);
            if (state.currentParams) renderer.render(state.currentParams);
        });
        document.getElementById('zoomOutBtn').addEventListener('click', () => {
            renderer.setZoom(renderer.zoomLevel - 0.2);
            if (state.currentParams) renderer.render(state.currentParams);
        });
        document.getElementById('resetZoomBtn').addEventListener('click', () => {
            renderer.setZoom(1.0);
            if (state.currentParams) renderer.render(state.currentParams);
        });

        // Export
        document.getElementById('exportImageBtn').addEventListener('click', () => {
            if (!state.currentParams) { showToast('请先生成心电图', 'warning'); return; }
            const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            renderer.downloadImage(`ecg-12lead-${ts}.png`);
            showToast('12导联心电图已导出', 'success');
        });

        // Window resize
        window.addEventListener('resize', debounce(() => {
            updateCanvasSize();
            if (state.currentParams) renderer.render(state.currentParams);
        }, 200));

        // Ctrl+Enter
        document.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); handleGenerate(); }
        });
    }

    function updateRendererConfig() {
        renderer.setPaperSpeed(state.displayConfig.paperSpeed);
        renderer.setGain(state.displayConfig.gain);
        renderer.setGrid(state.displayConfig.showGrid);
        renderer.setLabels(state.displayConfig.showLabels);
    }

    function updateCanvasSize() {
        if (renderer) renderer.initCanvas();
    }

    // ---- HANDLERS ----
    async function handleTestConnection() {
        const btn = document.getElementById('testConnectionBtn');
        const statusEl = document.getElementById('connectionStatus');
        const endpoint = document.getElementById('apiEndpoint').value.trim();
        const token = document.getElementById('apiToken').value.trim();
        const model = document.getElementById('modelName').value.trim();
        const temp = parseFloat(document.getElementById('temperature').value);

        if (!endpoint || !token) { showToast('请填写API Endpoint和Token', 'error'); return; }

        btn.disabled = true; btn.textContent = '测试中...';
        statusEl.textContent = ''; statusEl.className = 'status-text';
        aiClient.configure(endpoint, token, model, temp);
        try {
            const result = await aiClient.testConnection();
            statusEl.textContent = `已连接 (${result.model})`;
            statusEl.className = 'status-text status-success';
            showToast('连接成功', 'success');
        } catch (err) {
            statusEl.textContent = err.message;
            statusEl.className = 'status-text status-error';
            showToast(err.message, 'error');
        } finally {
            btn.disabled = false; btn.textContent = '测试连接';
        }
    }

    async function handleGenerate() {
        if (state.isGenerating) return;

        const condition = document.getElementById('conditionInput').value.trim();
        const additional = document.getElementById('additionalParams').value.trim();
        if (!condition) { showToast('请输入生理病理描述', 'warning'); return; }

        const endpoint = document.getElementById('apiEndpoint').value.trim();
        const token = document.getElementById('apiToken').value.trim();
        const model = document.getElementById('modelName').value.trim();
        const temp = parseFloat(document.getElementById('temperature').value);
        if (!endpoint || !token) { showToast('请先配置AI参数', 'warning'); return; }

        const btn = document.getElementById('generateBtn');
        const statusEl = document.getElementById('ecgStatus');
        const overlay = document.getElementById('placeholderOverlay');

        state.isGenerating = true;
        btn.disabled = true;
        btn.innerHTML = '<span class="spinner"></span> AI生成中...';
        statusEl.textContent = '正在调用AI...';
        statusEl.className = 'status-text status-loading';

        aiClient.configure(endpoint, token, model, temp);
        try {
            const result = await aiClient.generateECG(condition, additional);
            state.currentParams = result.params;
            if (overlay) overlay.style.display = 'none';
            updateRendererConfig();
            renderer.render(state.currentParams);
            statusEl.textContent = result.model ? `AI生成 (${result.model})` : 'AI生成完成';
            statusEl.className = 'status-text status-success';
            showToast('12导联心电图生成完成', 'success');
            syncAdvancedFields(state.currentParams);
        } catch (err) {
            statusEl.textContent = `失败: ${err.message}`;
            statusEl.className = 'status-text status-error';
            showToast(err.message, 'error');
        } finally {
            state.isGenerating = false;
            btn.disabled = false;
            btn.innerHTML = '&#9889; 生成心电图';
        }
    }

    // ---- ADVANCED OPTIONS ----
    function syncAdvancedFields(params) {
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };
        const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };

        setVal('advHeartRate', params.heartRate);
        setVal('advPR', params.prInterval);
        setVal('advQRSDur', params.qrsDuration);
        setVal('advQT', params.qtInterval);
        setVal('advPAmp', params.pAmplitude);
        setVal('advQrsAmp', params.qrsAmplitude);
        setVal('advTAmp', params.tAmplitude);
        setVal('advQrsAxis', params.qrsAxis || params.axis);
        setVal('advPAxis', params.pAxis);
        setVal('advTAxis', params.tAxis);
        setVal('advSTElev', params.stElevation);
        setVal('advSTDep', params.stDepression);

        const rhythmSel = document.getElementById('advRhythmType');
        if (rhythmSel) rhythmSel.value = params.rhythmType || '';

        const stShapeSel = document.getElementById('advSTShape');
        if (stShapeSel) stShapeSel.value = params.stShape || params.stSlope || '';

        const tShapeSel = document.getElementById('advTWaveShape');
        if (tShapeSel) tShapeSel.value = params.twaveShape || '';

        setChk('advTInverted', params.tInverted);
        setChk('advTPeaked', params.tPeaked);
        setChk('advTFlat', params.tFlattened);
        setChk('advQWave', !!params.qWave);
        setChk('advUWave', params.uWavePresent || params.uWaveProminent);
        setChk('advQrsWide', params.qrsDuration >= 120);
        setChk('advRbbb', params.rbbbRsrPattern);
        setChk('advPaced', params.rhythmType === 'paced');
        setChk('advQrsNotch', params.qrsNotching);
        setChk('advStDiscordant', params.stDiscordant);
    }

    function applyAdvancedOptions() {
        if (!state.currentParams) { showToast('请先生成或选择心电图模板', 'warning'); return; }

        const getNum = (id) => { const v = document.getElementById(id)?.value; return v !== '' && v !== undefined ? parseFloat(v) : null; };
        const getStr = (id) => { const v = document.getElementById(id)?.value; return v || null; };
        const getChk = (id) => document.getElementById(id)?.checked || false;

        const p = state.currentParams;

        // Apply numeric values (only if changed)
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

        // Apply booleans
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

        // Re-render
        updateRendererConfig();
        renderer.render(state.currentParams);

        // Update interpretation
        renderer.updateInterpretation(state.currentParams);

        const statusEl = document.getElementById('ecgStatus');
        if (statusEl) { statusEl.textContent = '参数已应用（手动调整）'; statusEl.className = 'status-text status-template'; }

        showToast('参数已应用', 'success');
    }

    // ---- TOAST ----
    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const icons = { success: '✓', error: '✗', warning: '!', info: 'i' };
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span> ${msg}`;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('toast-visible'));
        setTimeout(() => {
            toast.classList.remove('toast-visible');
            setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
        }, 4000);
    }

    function debounce(fn, delay) {
        let t; return function (...a) { clearTimeout(t); t = setTimeout(() => fn.apply(this, a), delay); };
    }

    // ---- START ----
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
