import { useEffect, useRef } from 'react';
import { useECG } from '../lib/ECGContext';
import { ECGRenderer } from '../lib/ecg-renderer';

export default function ECGDisplay() {
    const canvasRef = useRef(null);
    const containerRef = useRef(null);
    const { state, setRenderer, getRenderer, dispatch } = useECG();
    const { currentParams, status, displayConfig } = state;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const renderer = new ECGRenderer(canvas);
        renderer.onInterpretationChange = (data) => {
            dispatch({ type: 'SET_INTERPRETATION', payload: data });
        };
        setRenderer(renderer);

        // Show empty ECG paper on mount
        setTimeout(() => {
            renderer.renderInit({
                heartRate: 72, rhythmType: 'sinus',
                qrsDuration: 90, qtInterval: 390, qrsAxis: 30,
            });
        }, 100);
    }, [setRenderer, dispatch]);

    useEffect(() => {
        const renderer = getRenderer();
        if (!renderer || !currentParams) return;
        renderer.setPaperSpeed(displayConfig.paperSpeed);
        renderer.setGain(displayConfig.gain);
        renderer.setGrid(displayConfig.showGrid);
        renderer.setLabels(displayConfig.showLabels);
        renderer.renderInit(currentParams);
    }, [displayConfig]);

    return (
        <div className="ecg-display">
            <div className="ecg-toolbar">
                <span className={`status-text ${status.className || ''}`}>
                    {status.text}
                </span>
                <span className="toolbar-spacer" />
                <button type="button" className="btn btn-sm" title="放大"
                    onClick={() => { const r = getRenderer(); if (r) r.adjustZoom(0.2); }}>+</button>
                <button type="button" className="btn btn-sm" title="缩小"
                    onClick={() => { const r = getRenderer(); if (r) r.adjustZoom(-0.2); }}>&minus;</button>
                <button type="button" className="btn btn-sm" title="重置"
                    onClick={() => { const r = getRenderer(); if (r) r.resetZoom(); }}>1:1</button>
                <button type="button" className="btn btn-sm" title="导出图片"
                    onClick={() => {
                        const r = getRenderer();
                        if (!r || !currentParams) return;
                        const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        r.downloadImage(`ecg-12lead-${ts}.png`);
                    }}>导出</button>
            </div>
            <div className="canvas-container" ref={containerRef}>
                <canvas ref={canvasRef} className="ecg-canvas" />
            </div>
        </div>
    );
}
