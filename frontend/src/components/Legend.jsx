import React from 'react';
import { useTranslation } from 'react-i18next';

export const Legend = ({ graphData, isDarkMode }) => {
    const { t } = useTranslation();
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
            {edges.map((edge, idx) => {
                // Map backend labels to translation keys
                let labelKey = edge.label;
                if (edge.label === "Real Connection") labelKey = "legend_real_connection";
                else if (edge.label === "Directed Connection") labelKey = "legend_directed_connection";
                else if (edge.label === "Strong Similarity (>85%)") labelKey = "legend_strong_similarity";
                else if (edge.label === "Medium Similarity (>70%)") labelKey = "legend_medium_similarity";
                else if (edge.label === "Weak Similarity (>60%)") labelKey = "legend_weak_similarity";

                return (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                            style={{
                                width: '24px',
                                height: '2px',
                                background: edge.color
                            }}
                        />
                        <span style={{ fontSize: '11px', whiteSpace: 'nowrap' }}>{t(labelKey, edge.label)}</span>
                    </div>
                );
            })}
        </div>
    );
};
