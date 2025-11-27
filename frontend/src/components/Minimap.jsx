import React, { useEffect, useRef } from 'react';
import Sigma from 'sigma';

export const Minimap = ({ graph, mainRenderer, isDarkMode }) => {
    const containerRef = useRef(null);
    const minimapRef = useRef(null);

    useEffect(() => {
        if (!graph || !containerRef.current || !mainRenderer) return;

        // Create minimap renderer
        const minimap = new Sigma(graph, containerRef.current, {
            renderer: "canvas",
            renderLabels: false,
            enableEdgeEvents: false,
            defaultNodeColor: isDarkMode ? '#888' : '#666',
            defaultEdgeColor: isDarkMode ? '#444' : '#ccc',
            nodeReducer: (node, data) => ({
                ...data,
                size: 2,
                label: null
            }),
            edgeReducer: (edge, data) => ({
                ...data,
                size: 0.5
            })
        });

        minimapRef.current = minimap;

        // Sync camera with main renderer
        const syncCamera = () => {
            if (!mainRenderer || !minimap) return;
            const mainCamera = mainRenderer.getCamera();
            const minimapCamera = minimap.getCamera();

            // Show viewport rectangle (simplified - would need more work for full implementation)
            minimap.refresh();
        };

        mainRenderer.on('afterRender', syncCamera);

        return () => {
            mainRenderer.off('afterRender', syncCamera);
            minimap.kill();
        };
    }, [graph, mainRenderer, isDarkMode]);

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                width: '200px',
                height: '150px',
                background: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100
            }}
        >
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        </div>
    );
};
