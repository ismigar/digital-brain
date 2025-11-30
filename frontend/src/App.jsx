import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Layout } from './components/Layout';
import { Sidebar } from './components/Sidebar';
import { GraphViewer } from './components/GraphViewer';
import { Controls } from './components/Controls';
import { Legend } from './components/Legend';
import { Minimap } from './components/Minimap';
import { ConnectionList } from './components/ConnectionList';
import { SettingsModal } from './components/SettingsModal';
import './viewer/style.css'; // Import legacy styles

function App() {
  const { t } = useTranslation();
  const [graphData, setGraphData] = useState(null);
  const [graphInstance, setGraphInstance] = useState(null);
  const [rendererInstance, setRendererInstance] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(window.matchMedia('(prefers-color-scheme: dark)').matches);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Filter State
  const [searchTerm, setSearchTerm] = useState("");
  const [similarity, setSimilarity] = useState(70);
  const [hideIsolated, setHideIsolated] = useState(false);
  const [onlyIsolated, setOnlyIsolated] = useState(false);
  const [activeClusters, setActiveClusters] = useState(new Set());
  const [activeKinds, setActiveKinds] = useState(new Set());
  const [activeProjects, setActiveProjects] = useState(new Set());

  // Selection State
  const [selectedNode, setSelectedNode] = useState(null);
  const [depth, setDepth] = useState(1);

  const [config, setConfig] = useState(null);

  // Load Data
  useEffect(() => {
    // Fetch Graph Data
    fetch('/api/graph')
      .then(res => res.json())
      .then(data => {
        setGraphData(data);
      })
      .catch(err => console.error("Error loading graph:", err));

    // Fetch Config
    fetch('/api/config')
      .then(res => res.json())
      .then(data => setConfig(data))
      .catch(err => console.error("Error loading config:", err));

    // Dark mode listener
    const matcher = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e) => setIsDarkMode(e.matches);
    matcher.addEventListener('change', onChange);
    return () => matcher.removeEventListener('change', onChange);
  }, []);

  // Derived Data for Sidebar (Filter Options)
  const filterOptions = useMemo(() => {
    if (!graphData || !graphData.legend) return { clusters: [], kinds: [], projects: [] };

    // Kinds - filter out "Default"
    const kinds = (graphData.legend.kinds || [])
      .filter(k => k.label.toLowerCase() !== 'default')
      .map(k => ({
        label: k.label,
        value: k.label,
        color: k.color,
        count: k.count
      }));

    // Clusters (Tags) - Calculate counts from nodes to ensure accuracy
    const clusterCounts = {};
    graphData.nodes.forEach(n => {
      const tags = [n.cluster, ...(n.clusters_extra || [])].filter(Boolean);
      tags.forEach(t => {
        // Normalize to match legend format: lowercase and spaces to hyphens
        const normalized = t.toLowerCase().trim().replace(/\s+/g, '-');
        clusterCounts[normalized] = (clusterCounts[normalized] || 0) + 1;
      });
    });

    const clusters = (graphData.legend.clusters || []).map(c => {
      const normalizedLabel = c.label.toLowerCase().trim().replace(/\s+/g, '-');
      return {
        label: c.label,
        value: c.label,
        color: c.color,
        count: clusterCounts[normalizedLabel] || 0 // Use calculated count with normalized key
      };
    });

    // Projects - need to extract from nodes if not in legend, but viewer.js extracted from nodes
    // viewer.js: "graph.forEachNode((n, a) => ... projectesSet.add(project)"
    // We can do it from graphData.nodes
    const projectCounts = {};
    graphData.nodes.forEach(n => {
      const p = n.project;
      if (p && p !== "None" && p !== "Altres") {
        projectCounts[p] = (projectCounts[p] || 0) + 1;
      }
    });
    const projects = Object.keys(projectCounts).sort().map(p => ({
      label: p,
      value: p,
      color: "#757575",
      count: projectCounts[p]
    }));

    return { kinds, clusters, projects };
  }, [graphData]);

  // Handlers
  const toggleFilter = (set, value) => {
    const newSet = new Set(set);
    if (newSet.has(value)) newSet.delete(value);
    else newSet.add(value);
    return newSet;
  };

  const clearAllFilters = (setFilter) => {
    setFilter(new Set());
  };



  const graphViewerRef = useRef(null);

  // Filter Object to pass to GraphViewer
  const filters = useMemo(() => ({
    activeClusters,
    activeKinds,
    activeProjects,
    similarity,
    hideIsolated,
    onlyIsolated,
    selectedNode,
    depth,
    searchTerm
  }), [activeClusters, activeKinds, activeProjects, similarity, hideIsolated, onlyIsolated, selectedNode, depth, searchTerm]);


  // Helper for Sidebar lists
  const renderFilterList = (items, activeSet, setActive) => {
    if (!items || items.length === 0) return null;
    const maxCount = Math.max(...items.map(i => i.count), 1);

    return (
      <div className="filter-list">
        {items.map(item => (
          <div key={item.value} className="filter-item-advanced">
            <input
              type="checkbox"
              id={`filter-${item.value}`}
              checked={activeSet.has(item.value)}
              onChange={() => setActive(toggleFilter(activeSet, item.value))}
              style={{ display: 'none' }}
            />
            <label htmlFor={`filter-${item.value}`}>
              <span
                className="custom-checkbox"
                style={{
                  backgroundColor: item.color,
                  position: 'relative'
                }}
              >
                {activeSet.has(item.value) && (
                  <span style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: 'white',
                    transform: 'translate(-50%, -50%)'
                  }} />
                )}
              </span>
              <span className="filter-label-text">{item.label} ({item.count})</span>
            </label>
            <div className="density-bar-container">
              <div
                className="density-bar"
                style={{
                  width: `${(item.count / maxCount) * 100}%`,
                  backgroundColor: item.color
                }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <Layout
      onOpenSettings={() => setIsSettingsOpen(true)}
      sidebar={
        <Sidebar
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          similarity={similarity}
          onSimilarityChange={setSimilarity}
          hideIsolated={hideIsolated}
          onHideIsolatedChange={setHideIsolated}
          onlyIsolated={onlyIsolated}
          onOnlyIsolatedChange={setOnlyIsolated}
        >
          {/* ... sidebar sections ... */}
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="filter-title">{t('filter_by_kind')}</h2>
              {activeKinds.size > 0 && (
                <button
                  onClick={() => clearAllFilters(setActiveKinds)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                >
                  Deselect All
                </button>
              )}
            </div>
            {renderFilterList(filterOptions.kinds, activeKinds, setActiveKinds)}
          </div>
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="filter-title">{t('filter_by_cluster')}</h2>
              {activeClusters.size > 0 && (
                <button
                  onClick={() => clearAllFilters(setActiveClusters)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                >
                  Deselect All
                </button>
              )}
            </div>
            {renderFilterList(filterOptions.clusters, activeClusters, setActiveClusters)}
          </div>
          <div className="section">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <h2 className="filter-title">{t('filter_by_project')}</h2>
              {activeProjects.size > 0 && (
                <button
                  onClick={() => clearAllFilters(setActiveProjects)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: '12px',
                    textDecoration: 'underline'
                  }}
                >
                  Deselect All
                </button>
              )}
            </div>
            {renderFilterList(filterOptions.projects, activeProjects, setActiveProjects)}
          </div>

          {
            selectedNode && (
              <div className="section">
                <div id="depth-controls" className="depth-controls" style={{ display: 'block' }}>
                  <p>Mostrant veïns de:</p>
                  <strong>
                    {graphInstance ? (graphInstance.getNodeAttribute(selectedNode, 'label') || selectedNode) : selectedNode}
                  </strong>
                  <div className="depth-slider-container">
                    <label htmlFor="depth-slider">{t('depth_filter')}:</label>
                    <input
                      type="range"
                      id="depth-slider"
                      min="1"
                      max="5"
                      value={depth}
                      step="1"
                      onChange={(e) => setDepth(parseInt(e.target.value))}
                    />
                    <span id="depth-label">{depth}</span>
                  </div>
                  <button id="clear-selection-btn" onClick={() => setSelectedNode(null)}>Neteja la selecció</button>
                </div>
              </div>
            )
          }
        </Sidebar >
      }
      controls={
        <Controls
          onZoomIn={() => graphViewerRef.current?.zoomIn()}
          onZoomOut={() => graphViewerRef.current?.zoomOut()}
          onCenter={() => graphViewerRef.current?.center()}
          onFullscreen={() => graphViewerRef.current?.fullscreen()}
        />
      }
      bottomPanel={
        <div style={{
          padding: '20px',
          background: isDarkMode ? '#111' : '#f7f7f7'
        }}>
          <ConnectionList graphInstance={graphInstance} filters={filters} isDarkMode={isDarkMode} />
        </div>
      }
      containerStyle={{ display: 'block' }}
    >
      <div style={{ height: '100%', position: 'relative', minHeight: '600px' }}>
        <GraphViewer
          ref={graphViewerRef}
          graphData={graphData}
          setGraphInstance={setGraphInstance}
          setRendererInstance={setRendererInstance}
          filters={filters}
          onNodeClick={(node) => setSelectedNode(prev => prev === node ? null : node)}
          isDarkMode={isDarkMode}
          config={config}
        />
        <Legend graphData={graphData} isDarkMode={isDarkMode} />
        <Legend graphData={graphData} isDarkMode={isDarkMode} />
        <Minimap
          graph={graphInstance}
          mainRenderer={rendererInstance}
          isDarkMode={isDarkMode}
          onPanTo={(x, y, ratio) => graphViewerRef.current?.panTo(x, y, ratio)}
          onPanToNode={(nodeId, ratio) => graphViewerRef.current?.panToNode(nodeId, ratio)}
        />
      </div>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setIsSettingsOpen(false);
          // Reload config to apply changes immediately
          fetch('/api/config')
            .then(res => res.json())
            .then(data => setConfig(data))
            .catch(err => console.error("Error reloading config:", err));
        }}
      />
    </Layout>
  );
}

export default App;
