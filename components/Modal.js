'use client';
import { useState, useEffect } from 'react';

export default function Modal({ isOpen, title, message, onConfirm, onCancel, confirmText = 'OK', cancelText = null, type = 'info' }) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  const accentColor = type === 'danger' ? 'var(--accent-red)' : type === 'success' ? 'var(--accent-green)' : 'var(--accent-primary)';

  return (
    <div className="modal-overlay" onClick={onCancel || onConfirm}>
      <div className="modal-box animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="modal-icon-row">
          {type === 'danger' && (
            <div className="modal-icon" style={{ background: 'rgba(239,68,68,0.12)', color: 'var(--accent-red)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
          {type === 'success' && (
            <div className="modal-icon" style={{ background: 'rgba(34,197,94,0.12)', color: 'var(--accent-green)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M22 11.08V12a10 10 0 11-5.93-9.14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M22 4L12 14.01l-3-3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
          {type === 'info' && (
            <div className="modal-icon" style={{ background: 'rgba(61,114,245,0.12)', color: 'var(--accent-primary)' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/><path d="M12 16v-4M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
          )}
        </div>
        <h3 className="modal-title">{title}</h3>
        {message && <p className="modal-message">{message}</p>}
        <div className="modal-actions">
          {cancelText && onCancel && (
            <button className="btn btn-secondary" onClick={onCancel}>{cancelText}</button>
          )}
          <button
            className="btn btn-primary"
            style={type === 'danger' ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)' } : {}}
            onClick={onConfirm}
          >
            {confirmText}
          </button>
        </div>
      </div>

      <style jsx>{`
        .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }
        .modal-box {
          background: var(--bg-card);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-xl);
          padding: 32px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 60px rgba(0,0,0,0.5);
          text-align: center;
        }
        .modal-icon-row {
          display: flex;
          justify-content: center;
          margin-bottom: 16px;
        }
        .modal-icon {
          width: 52px;
          height: 52px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .modal-title {
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--text-primary);
          margin-bottom: 8px;
        }
        .modal-message {
          font-size: 0.95rem;
          color: var(--text-secondary);
          line-height: 1.6;
          margin-bottom: 24px;
        }
        .modal-actions {
          display: flex;
          gap: 12px;
          justify-content: center;
        }
        .modal-actions .btn {
          min-width: 100px;
        }
      `}</style>
    </div>
  );
}
