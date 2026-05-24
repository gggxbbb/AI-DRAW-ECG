import { useECG } from '../lib/ECGContext';

export default function Toast() {
    const { state } = useECG();
    const { toasts } = state;

    if (!toasts || toasts.length === 0) return null;

    return (
        <div className="toast-container">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast-${toast.type}`}>
                    <span className="toast-icon">{toast.icon}</span> {toast.message}
                </div>
            ))}
        </div>
    );
}
