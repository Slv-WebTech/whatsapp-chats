import React from 'react';
import { BRAND } from '../config/branding';

class AppErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, message: '' };
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            message: error instanceof Error ? error.message : 'An unexpected error occurred.'
        };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Unhandled application error:', error, errorInfo);
    }

    handleReload = () => {
        window.location.reload();
    };

    render() {
        if (this.state.hasError) {
            return (
                <div
                    style={{
                        minHeight: '100dvh',
                        display: 'grid',
                        placeItems: 'center',
                        padding: '1.5rem',
                        background: 'linear-gradient(160deg, #081318 0%, #0f172a 100%)',
                        color: '#e2e8f0',
                        fontFamily: "'Inter', 'Segoe UI', sans-serif"
                    }}
                >
                    <div
                        style={{
                            width: '100%',
                            maxWidth: '28rem',
                            border: '1px solid rgba(148,163,184,0.35)',
                            borderRadius: '1rem',
                            background: 'rgba(15,23,42,0.75)',
                            backdropFilter: 'blur(8px)',
                            padding: '1.25rem'
                        }}
                    >
                        <p style={{ margin: 0, fontSize: '0.75rem', letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>
                            {BRAND.name}
                        </p>
                        <h1 style={{ margin: '0.4rem 0 0', fontSize: '1.125rem', fontWeight: 700 }}>Something went wrong</h1>
                        <p style={{ margin: '0.5rem 0 0', fontSize: '0.9rem', opacity: 0.86 }}>
                            The app hit an unexpected error. Reload to recover safely.
                        </p>
                        {this.state.message ? (
                            <p style={{ margin: '0.75rem 0 0', fontSize: '0.8rem', opacity: 0.68 }}>
                                Error: {this.state.message}
                            </p>
                        ) : null}
                        <button
                            type="button"
                            onClick={this.handleReload}
                            style={{
                                marginTop: '1rem',
                                border: 'none',
                                borderRadius: '0.65rem',
                                background: '#10b981',
                                color: '#042f2e',
                                fontWeight: 700,
                                fontSize: '0.875rem',
                                padding: '0.62rem 0.9rem',
                                cursor: 'pointer'
                            }}
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default AppErrorBoundary;