import type { Toast } from '../context/RealtimeStore';
import { CheckCircle, XCircle, Info, AlertTriangle, X } from 'lucide-react';

type Props = {
  toasts: Toast[];
  onRemove: (id: string) => void;
};

const ICONS = {
  success: <CheckCircle size={16} />,
  error: <XCircle size={16} />,
  info: <Info size={16} />,
  warning: <AlertTriangle size={16} />,
};

export default function ToastContainer({ toasts, onRemove }: Props) {
  return (
    <div className="toast-container">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.type}`}>
          <span style={{ color: `var(--${t.type === 'info' ? 'brand' : t.type})`, flexShrink: 0 }}>
            {ICONS[t.type]}
          </span>
          <span style={{ flex: 1, fontSize: 13 }}>{t.message}</span>
          <button
            className="btn-ghost btn-icon"
            style={{ padding: 4, color: 'var(--text-muted)' }}
            onClick={() => onRemove(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
