import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './SettingsModal.css'; // We'll create this for basic styling

export function SettingsModal({ isOpen, onClose }) {
    const { t, i18n } = useTranslation();
    const [config, setConfig] = useState(null);
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadConfig();
        }
    }, [isOpen]);

    const loadConfig = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/config');
            const data = await res.json();
            setConfig(data);
        } catch (err) {
            console.error("Error loading config:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await fetch('/api/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config)
            });
            onClose();
            // Optional: Reload page to apply all changes cleanly
            window.location.reload();
        } catch (err) {
            console.error("Error saving config:", err);
        } finally {
            setSaving(false);
        }
    };

    const handleChange = (path, value) => {
        setConfig(prev => {
            const newConfig = { ...prev };
            let current = newConfig;
            const keys = path.split('.');
            const lastKey = keys.pop();

            for (const key of keys) {
                if (!current[key]) current[key] = {};
                current = current[key];
            }
            current[lastKey] = value;
            return newConfig;
        });
    };

    const handleLanguageChange = (lang) => {
        i18n.changeLanguage(lang);
        // We don't necessarily save this to params.yaml unless we want it persistent across server restarts
        // For now, let's just change it in the session. 
        // If we want to save it, we'd need a 'language' field in params.yaml.
    };

    if (!isOpen) return null;

    return (
        <div className="settings-modal-overlay">
            <div className="settings-modal">
                <div className="settings-header">
                    <h2>{t('settings') || 'Settings'}</h2>
                    <button className="close-btn" onClick={onClose}>&times;</button>
                </div>

                <div className="settings-tabs">
                    <button className={activeTab === 'general' ? 'active' : ''} onClick={() => setActiveTab('general')}>General</button>
                    <button className={activeTab === 'visual' ? 'active' : ''} onClick={() => setActiveTab('visual')}>Visual</button>
                    <button className={activeTab === 'ai' ? 'active' : ''} onClick={() => setActiveTab('ai')}>AI</button>
                    <button className={activeTab === 'notion' ? 'active' : ''} onClick={() => setActiveTab('notion')}>Notion</button>
                </div>

                <div className="settings-content">
                    {loading ? <p>Loading...</p> : (
                        <>
                            {activeTab === 'general' && (
                                <div className="settings-section">
                                    <h3>Language</h3>
                                    <select value={i18n.language} onChange={(e) => handleLanguageChange(e.target.value)}>
                                        <option value="en">English</option>
                                        <option value="es">Español</option>
                                        <option value="ca">Català</option>
                                        <option value="fr">Français</option>
                                    </select>
                                </div>
                            )}

                            {activeTab === 'visual' && config && config.colors && (
                                <div className="settings-section">
                                    <h3>Node Colors</h3>
                                    <div className="color-grid">
                                        {Object.entries(config.colors.node_types || {}).map(([type, styles]) => (
                                            <div key={type} className="color-item">
                                                <label style={{ fontWeight: 'bold', marginBottom: '5px', display: 'block' }}>{type}</label>
                                                <div className="color-inputs" style={{ display: 'flex', gap: '10px' }}>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <input
                                                            type="color"
                                                            value={styles.bg}
                                                            onChange={(e) => handleChange(`colors.node_types.${type}.bg`, e.target.value)}
                                                            title="Background"
                                                        />
                                                        <span style={{ fontSize: '0.8em', marginTop: '2px' }}>Bg</span>
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                                        <input
                                                            type="color"
                                                            value={styles.border}
                                                            onChange={(e) => handleChange(`colors.node_types.${type}.border`, e.target.value)}
                                                            title="Border"
                                                        />
                                                        <span style={{ fontSize: '0.8em', marginTop: '2px' }}>Border</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <h3>Edge Colors</h3>
                                    {config.colors.edges && (
                                        <div className="color-grid">
                                            <div className="color-item">
                                                <label>Explicit (Real)</label>
                                                <input
                                                    type="color"
                                                    value={config.colors.edges.explicit_color}
                                                    onChange={(e) => handleChange('colors.edges.explicit_color', e.target.value)}
                                                />
                                            </div>
                                            <div className="color-item">
                                                <label>Direct</label>
                                                <input
                                                    type="color"
                                                    value={config.colors.edges.direct_color}
                                                    onChange={(e) => handleChange('colors.edges.direct_color', e.target.value)}
                                                />
                                            </div>
                                            <div className="color-item">
                                                <label>Default Inferred</label>
                                                <input
                                                    type="color"
                                                    value={config.colors.edges.default_inferred_color}
                                                    onChange={(e) => handleChange('colors.edges.default_inferred_color', e.target.value)}
                                                />
                                            </div>
                                            <div className="color-item">
                                                <label>Tag Edge</label>
                                                <input
                                                    type="color"
                                                    value={config.colors.edges.tag_edge_color || "#E0E0E0"}
                                                    onChange={(e) => handleChange('colors.edges.tag_edge_color', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {config.colors.edges && config.colors.edges.similarity_buckets && (
                                        <>
                                            <h4>Similarity Levels</h4>
                                            <div className="color-grid">
                                                {config.colors.edges.similarity_buckets.map((bucket, index) => (
                                                    <div key={index} className="color-item">
                                                        <label>{bucket.label} (&gt; {bucket.min}%)</label>
                                                        <input
                                                            type="color"
                                                            value={bucket.color}
                                                            onChange={(e) => handleChange(`colors.edges.similarity_buckets.${index}.color`, e.target.value)}
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    <h3>Graph Colors</h3>
                                    <div className="form-group">
                                        <label>Background</label>
                                        <input
                                            type="color"
                                            value={config.colors.default_bg}
                                            onChange={(e) => handleChange('colors.default_bg', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'ai' && config && config.ai && (
                                <div className="settings-section">
                                    <div className="form-group">
                                        <label>Model Name</label>
                                        <input
                                            type="text"
                                            value={config.ai.model_name}
                                            onChange={(e) => handleChange('ai.model_name', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Model URL</label>
                                        <input
                                            type="text"
                                            value={config.ai.model_url}
                                            onChange={(e) => handleChange('ai.model_url', e.target.value)}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Timeout (seconds)</label>
                                        <input
                                            type="number"
                                            value={config.ai.timeout}
                                            onChange={(e) => handleChange('ai.timeout', parseInt(e.target.value))}
                                        />
                                    </div>
                                </div>
                            )}

                            {activeTab === 'notion' && config && config.notion && (
                                <div className="settings-section">
                                    <div className="form-group">
                                        <label>Database ID</label>
                                        <input
                                            type="text"
                                            value={config.notion.NOTION_DATABASE || ''}
                                            disabled
                                            title="Set via Environment Variable"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Title Property</label>
                                        <input
                                            type="text"
                                            value={config.notion.title_property}
                                            onChange={(e) => handleChange('notion.title_property', e.target.value)}
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </div>

                <div className="settings-footer">
                    <button className="cancel-btn" onClick={onClose}>Cancel</button>
                    <button className="save-btn" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving...' : 'Save & Reload'}
                    </button>
                </div>
            </div>
        </div>
    );
}
