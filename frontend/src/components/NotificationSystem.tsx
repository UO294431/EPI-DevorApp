import React, { createContext, useContext, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from 'lucide-react';

type NotificationType = 'success' | 'error' | 'info' | 'warning';

interface Notification {
  id: number;
  message: string;
  type: NotificationType;
  removing?: boolean;
}

interface ConfirmState {
  open: boolean;
  message: string;
  title: string;
  resolve?: (value: boolean) => void;
  isDanger?: boolean;
}

interface NotificationContextType {
  showNotification: (message: string, type?: NotificationType) => void;
  showConfirm: (message: string, title?: string, isDanger?: boolean) => Promise<boolean>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotification must be used within a NotificationProvider');
  return context;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [confirm, setConfirm] = useState<ConfirmState>({ open: false, message: '', title: '' });

  const showNotification = useCallback((message: string, type: NotificationType = 'info') => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, removing: true } : n));
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== id));
      }, 200);
    }, 4000);
  }, []);

  const showConfirm = useCallback((message: string, title: string = 'Confirmación', isDanger: boolean = false) => {
    return new Promise<boolean>((resolve) => {
      setConfirm({ open: true, message, title, resolve, isDanger });
    });
  }, []);

  const handleConfirm = (value: boolean) => {
    if (confirm.resolve) confirm.resolve(value);
    setConfirm({ ...confirm, open: false });
  };

  return (
    <NotificationContext.Provider value={{ showNotification, showConfirm }}>
      {children}
      
      {/* Toast Container */}
      <div className="toast-container">
        {notifications.map(n => (
          <div key={n.id} className={`toast ${n.type} ${n.removing ? 'removing' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
                {n.type === 'success' && <CheckCircle size={22} className="text-success" />}
                {n.type === 'error' && <AlertCircle size={22} className="text-error" />}
                {n.type === 'warning' && <AlertTriangle size={22} style={{ color: '#facc15' }} />}
                {n.type === 'info' && <Info size={22} color="var(--accent)" />}
                <span style={{ lineHeight: 1.5 }}>{n.message}</span>
            </div>
            <button onClick={() => setNotifications(prev => prev.filter(item => item.id !== n.id))} style={{ marginLeft: 'var(--space-2)', display: 'flex', opacity: 0.5, padding: '4px' }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      {/* Confirm Modal */}
      {confirm.open && (
        <div
          className="modal-overlay"
          onClick={() => handleConfirm(false)}
          onKeyDown={(e) => e.key === 'Escape' && handleConfirm(false)}
          aria-hidden="true"
        >
          <div className="modal-card" onClick={e => e.stopPropagation()}>
            <div className="modal-body">
              <div className="modal-title">{confirm.title}</div>
              <div className="modal-text">{confirm.message}</div>
            </div>
            <div className="modal-actions">
              <button className="modal-btn modal-btn-cancel" onClick={() => handleConfirm(false)}>
                Cancelar
              </button>
              <button 
                className={`modal-btn modal-btn-confirm ${confirm.isDanger ? 'danger' : ''}`} 
                onClick={() => handleConfirm(true)}
              >
                {confirm.isDanger ? 'Eliminar' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};
