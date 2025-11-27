import React from 'react';

export function Layout({ children, sidebar, controls, containerStyle = {} }) {
  const [isPanelOpen, setIsPanelOpen] = React.useState(true);

  return (
    <div id="app">
      <header id="top-bar">
        <h1>Cervell Digital</h1>
        <button
          id="btn-toggle-panel"
          title="Mostra / amaga panell"
          onClick={() => setIsPanelOpen(!isPanelOpen)}
        >
          ☰
        </button>
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
    </div>
  );
}
