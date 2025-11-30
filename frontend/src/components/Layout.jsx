import React from 'react';

export function Layout({ children, sidebar, controls, bottomPanel, containerStyle = {}, onOpenSettings }) {
  const [isPanelOpen, setIsPanelOpen] = React.useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = React.useState(false);

  return (
    <div id="app" className={!isPanelOpen ? 'panel-hidden' : ''}>
      <header id="top-bar">
        <h1>Cervell Digital</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            id="btn-settings"
            title="Configuració"
            onClick={onOpenSettings}
            style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
          >
            ⚙️
          </button>
          <button
            id="btn-toggle-panel"
            title="Mostra / amaga panell"
            onClick={() => setIsPanelOpen(!isPanelOpen)}
          >
            ☰
          </button>
        </div>
      </header>

      <main id="main-content">
        <div id="sigma-container" style={{ position: 'relative', width: '100%', height: '100%', ...containerStyle }}>
          {children}
          {controls}
        </div>

        <aside id="side-panel" style={{ display: isPanelOpen ? 'block' : 'none' }}>
          {sidebar}
        </aside>
      </main>

      <div id="bottom-panel-wrapper" style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-side)',
        borderTop: '1px solid var(--color-border)',
        zIndex: 20
      }}>
        <button
          onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
          style={{
            width: '100%',
            padding: '8px',
            background: 'none',
            border: 'none',
            borderBottom: isBottomPanelOpen ? '1px solid var(--color-border)' : 'none',
            cursor: 'pointer',
            color: 'var(--color-text)',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {isBottomPanelOpen ? '▼ Amaga Connexions' : '▲ Mostra Connexions'}
        </button>
        {isBottomPanelOpen && (
          <div style={{ maxHeight: '35vh', overflowY: 'auto' }}>
            {bottomPanel}
          </div>
        )}
      </div>
    </div>
  );
}
