import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { useI18n } from '../i18n';
import { Icon } from './Icon';

type Kind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: Kind;
  message: string;
}

const ToastContext = createContext<((kind: Kind, message: string) => void) | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const dismiss = useCallback((id: number) => setItems((list) => list.filter((i) => i.id !== id)), []);

  const notify = useCallback(
    (kind: Kind, message: string) => {
      const id = ++counter.current;
      setItems((list) => [...list, { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 7000);
    },
    [dismiss],
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" aria-live="polite">
        {items.map((item) => (
          <div key={item.id} className={`toast toast--${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}>
            <Icon name={item.kind === 'error' ? 'alert' : item.kind === 'success' ? 'check' : 'info'} />
            <p>{item.message}</p>
            <button type="button" className="toast__close" onClick={() => dismiss(item.id)} aria-label={t('common.close')}>
              <Icon name="x" size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}
