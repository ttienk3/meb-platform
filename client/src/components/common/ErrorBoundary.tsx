import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🔥 [MEB ErrorBoundary Caught]:', error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleGoHome = () => {
    window.location.href = '/';
  };

  private handleClearCacheAndReload = () => {
    try {
      localStorage.removeItem('meb_pos_order_drafts');
      localStorage.removeItem('meb_pos_active_draft_id');
      localStorage.removeItem('pos_catalog_view');
      sessionStorage.clear();
      if ('caches' in window) {
        caches.keys().then((names) => {
          names.forEach(name => caches.delete(name));
        });
      }
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((regs) => {
          regs.forEach(r => r.unregister());
        });
      }
    } catch (e) {
      console.error('Error clearing cache:', e);
    }
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
          background: 'var(--bg-main, #f8fafc)',
          color: 'var(--text-main, #0f172a)',
          fontFamily: 'Inter, system-ui, sans-serif'
        }}>
          <div style={{
            maxWidth: 520,
            width: '100%',
            background: 'var(--bg-card, #ffffff)',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid var(--border-subtle, #e2e8f0)',
            textAlign: 'center'
          }}>
            <div style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <AlertTriangle size={28} />
            </div>

            <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 8px', color: 'var(--text-main, #0f172a)' }}>
              {this.props.fallbackTitle || 'Hệ Thống Đang Tự Động Phục Hồi'}
            </h2>

            <p style={{ fontSize: 14, color: 'var(--text-muted, #64748b)', margin: '0 0 24px', lineHeight: 1.5 }}>
              Đã phát hiện dữ liệu hiển thị cũ hoặc xung đột bộ nhớ đệm (Cache). Bạn có thể thử tải lại hoặc làm sạch dữ liệu tạm để tiếp tục bán hàng.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                onClick={this.handleReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 10,
                  background: 'var(--primary, #0284c7)',
                  color: '#ffffff',
                  fontWeight: 600,
                  fontSize: 14,
                  border: 'none',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw size={16} /> Tải lại trang (Reload)
              </button>

              <button
                type="button"
                onClick={this.handleGoHome}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '12px 20px',
                  borderRadius: 10,
                  background: 'var(--bg-subtle, #f1f5f9)',
                  color: 'var(--text-main, #0f172a)',
                  fontWeight: 600,
                  fontSize: 14,
                  border: '1px solid var(--border-subtle, #cbd5e1)',
                  cursor: 'pointer'
                }}
              >
                <Home size={16} /> Về Màn Hình Chính
              </button>

              <button
                type="button"
                onClick={this.handleClearCacheAndReload}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  background: 'transparent',
                  color: '#ef4444',
                  fontWeight: 500,
                  fontSize: 13,
                  border: '1px dashed #fca5a5',
                  cursor: 'pointer',
                  marginTop: 6
                }}
              >
                <Trash2 size={15} /> Xóa Bộ Nhớ Đệm & Đặt Lại Giao Diện
              </button>
            </div>

            {this.state.error && (
              <details style={{ marginTop: 20, textAlign: 'left', fontSize: 12, color: 'var(--text-dim, #94a3b8)' }}>
                <summary style={{ cursor: 'pointer', outline: 'none' }}>Chi tiết kỹ thuật</summary>
                <pre style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 8,
                  background: 'var(--bg-subtle, #f1f5f9)',
                  overflowX: 'auto',
                  fontSize: 11,
                  whiteSpace: 'pre-wrap'
                }}>
                  {this.state.error.toString()}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
