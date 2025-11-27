import React from 'react';

export function Sidebar({
    searchTerm,
    onSearchChange,
    similarity,
    onSimilarityChange,
    hideIsolated,
    onHideIsolatedChange,
    onlyIsolated,
    onOnlyIsolatedChange,
    children
}) {
    return (
        <>
            <div className="section">
                <h2 className="filter-title">Cerca</h2>
                <input
                    type="search"
                    id="search-input"
                    placeholder="Cerca per títol o tag..."
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>

            {children}

            <div className="section">
                <h2 className="filter-title">Similitud d'arestes</h2>
                <div className="similarity-filter">
                    <input
                        type="range"
                        id="similarity-slider"
                        min="0"
                        max="100"
                        value={similarity}
                        step="1"
                        onChange={(e) => onSimilarityChange(parseInt(e.target.value))}
                    />
                    <label htmlFor="similarity-slider" id="similarity-label">Mínim: {similarity}%</label>
                </div>
            </div>

            <div className="section">
                <div className="filter-item">
                    <input
                        type="checkbox"
                        id="isolated-nodes-filter"
                        checked={hideIsolated}
                        onChange={(e) => onHideIsolatedChange(e.target.checked)}
                    />
                    <label htmlFor="isolated-nodes-filter">Oculta nodes aïllats</label>
                </div>

                {!hideIsolated && (
                    <div className="filter-item">
                        <input
                            type="checkbox"
                            id="only-isolated-filter"
                            checked={onlyIsolated}
                            onChange={(e) => onOnlyIsolatedChange(e.target.checked)}
                        />
                        <label htmlFor="only-isolated-filter">Mostra només nodes aïllats</label>
                    </div>
                )}
            </div>
        </>
    );
}
