import React from 'react';

export const Legend = ({ graphData, isDarkMode }) => {
    if (!graphData || !graphData.legend) return null;

    const { edges = [] } = graphData.legend;

    if (edges.length === 0) return null;

    // Minimap width is 200px + 20px left margin = 220px
    // We want the legend centered but shifted right to avoid overlap
    const legendOffset = 85;

    return (
        <div
            style={{
                position: 'absolute',
                bottom: '20px',
                left: `calc(50% + ${legendOffset}px)`,
                transform: 'translateX(-50%)',
                background: isDarkMode ? 'rgba(30, 30, 30, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                color: isDarkMode ? '#fff' : '#000',
                padding: '12px 20px',
                borderRadius: '8px',
                border: `1px solid ${isDarkMode ? '#444' : '#ddd'}`,
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 100,
                display: 'flex',
                alignItems: 'center',
                gap: '20px'
            }}
        >
            {edges.map((edge, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div
                        style={{
                            width: '24px',
                            height: '2px',
                            background: edge.color
                        }}
                    />
                    <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{edge.label}</span>
                </div>
            ))}
        </div>
    );
};
