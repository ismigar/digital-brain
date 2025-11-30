import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import Graph from 'graphology';
import Sigma from 'sigma';
import { applyFilters } from '../utils/graphFilters';


export const GraphViewer = forwardRef(({
    graphData,
    setGraphInstance,
    setRendererInstance,
    filters,
    onNodeClick,
    onNodeHover,
    isDarkMode,
    config
}, ref) => {
    const containerRef = useRef(null);
    const rendererRef = useRef(null);
    const graphRef = useRef(null);
    const [edgeTooltip, setEdgeTooltip] = useState(null);

    // Sync prop to ref so renderer can access latest value without re-init
    const isDarkModeRef = useRef(isDarkMode);

    useEffect(() => {
        isDarkModeRef.current = isDarkMode;
        if (rendererRef.current) rendererRef.current.refresh();
    }, [isDarkMode]);

    useImperativeHandle(ref, () => ({
        zoomIn: () => {
            const camera = rendererRef.current?.getCamera();
            if (camera) camera.animatedZoom({ duration: 500 });
        },
        zoomOut: () => {
            const camera = rendererRef.current?.getCamera();
            if (camera) camera.animatedUnzoom({ duration: 500 });
        },
        center: () => {
            const camera = rendererRef.current?.getCamera();
            // Use the well-centered view that shows the full graph properly
            if (camera) camera.animate({ x: 0.5, y: 0.4, ratio: 1.4 }, { duration: 700 });
        },
        fullscreen: () => {
            if (containerRef.current) {
                if (document.fullscreenElement !== containerRef.current) {
                    containerRef.current.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            }
        },
        panTo: (x, y, ratio = 1.0) => {
            const renderer = rendererRef.current || window.sigmaRenderer;
            const camera = renderer?.getCamera();

            if (renderer && camera) {
                // Ensure coordinates are numbers
                const safeX = Number(x);
                const safeY = Number(y);

                // Removed forced resize as it might cause issues
                // renderer.resize();

                if (!isNaN(safeX) && !isNaN(safeY)) {
                    camera.animate({ x: safeX, y: safeY, ratio }, { duration: 500 });
                }
            }
        },
        panToNode: (nodeId, ratio = null) => {
            const renderer = rendererRef.current || window.sigmaRenderer;
            const camera = renderer?.getCamera();

            // ALWAYS use the graph from the renderer. This is the Source of Truth.
            // graphRef.current might be stale or point to a different instance (Split Brain).
            const graph = renderer?.getGraph();

            if (renderer && camera && graph && graph.hasNode(nodeId)) {
                const nodeAttrs = graph.getNodeAttributes(nodeId);

                // Use provided ratio, or current ratio, or default to 1
                const targetRatio = ratio !== null ? ratio : camera.ratio;

                // CRITICAL: Node coordinates are in "graph space", but camera coordinates
                // appear to be normalized. We need to transform them.
                // Based on observation: camera at (0.5, 0.4) shows the well-centered graph.
                // This suggests the camera operates in a normalized [0,1] space.

                // Get all nodes to calculate bounds
                let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
                graph.forEachNode((_, attrs) => {
                    minX = Math.min(minX, attrs.x);
                    maxX = Math.max(maxX, attrs.x);
                    minY = Math.min(minY, attrs.y);
                    maxY = Math.max(maxY, attrs.y);
                });

                const graphWidth = maxX - minX;
                const graphHeight = maxY - minY;

                // Transform node coordinates to normalized camera space [0, 1]
                // Formula: normalized = (value - min) / range
                const normalizedX = (nodeAttrs.x - minX) / graphWidth;
                // IMPORTANT: Invert Y axis because camera Y is inverted
                const normalizedY = 1 - (nodeAttrs.y - minY) / graphHeight;

                // Debug logs removed for production

                // Use animate for smooth camera movement
                camera.animate({
                    x: normalizedX,
                    y: normalizedY,
                    ratio: targetRatio
                }, {
                    duration: 500,
                    easing: 'cubicInOut'
                });

                // Camera state logging removed for production
            } else {
                console.warn(`GraphViewer: Could not pan to node ${nodeId} (Renderer: ${!!renderer}, Graph: ${!!graph})`);
            }
        }
    }));

    // Initialize Graph and Sigma
    useEffect(() => {
        if (!graphData || !containerRef.current) return;

        // Wait for container to have dimensions
        if (containerRef.current.offsetWidth === 0 || containerRef.current.offsetHeight === 0) {
            console.warn("GraphViewer: Container has no dimensions, waiting for resize...");
            return;
        }

        // 1. Create Graph
        const graph = new Graph();
        graphData.nodes.forEach(n => {
            graph.addNode(String(n.key), {
                ...n,
                x: Number(n.x),
                y: Number(n.y),
                size: Number(n.size || 3)
            });
        });
        graphData.edges.forEach(e => {
            const source = String(e.source);
            const target = String(e.target);
            if (!graph.hasNode(source) || !graph.hasNode(target)) return;
            if (e.directed) {
                graph.addDirectedEdge(source, target, e);
            } else {
                graph.addUndirectedEdge(source, target, e);
            }
        });

        graphRef.current = graph;
        setGraphInstance(graph);

        // 2. Define Reducers (Hover logic)
        // We'll use a simple state for hovered node to trigger re-renders of reducers if needed,
        // but Sigma reducers are functions. We can use a closure variable if we re-instantiate Sigma,
        // or better, use the setSetting method if available, or just rely on the fact that
        // we pass the reducer functions that read from a mutable ref or external state.
        // For simplicity, let's keep the reducers simple for now.

        // 2. Define Reducers (Hover logic)
        let hoveredNode = null;
        let hoverDistances = {};

        const nodeReducer = (node, data) => {
            if (data.hidden) return { ...data, hidden: true, label: "" };
            const res = { ...data };

            // Apply dynamic colors from config
            if (config && config.colors && config.colors.node_types) {
                const nodeType = data.kind || 'default';
                const typeConfig = config.colors.node_types[nodeType] || config.colors.node_types.default;

                if (typeConfig) {
                    res.color = typeConfig.bg;
                    // Store border and font for label renderer
                    res.borderColor = typeConfig.border;
                    res.fontColor = typeConfig.font;
                }
            }

            // Set label color based on dark mode
            const isDark = isDarkModeRef.current;
            res.labelColor = isDark ? "#ffffff" : "#000000";

            // Always show labels
            res.label = data.label;

            if (hoveredNode) {
                const d = hoverDistances[node] ?? 99;
                // Neighbors (d=1) and hovered (d=0) stay visible
                if (d <= 1) {
                    res.opacity = 1;
                    res.label = data.label;
                    res.zIndex = 10;
                } else {
                    // Others fade out
                    res.opacity = 0.1;
                    res.label = "";
                    res.zIndex = 0;
                    // Optional: make them grey
                    // res.color = isDarkModeRef.current ? "#333" : "#eee";
                }

                if (node === hoveredNode) res.highlighted = true;
            }
            return res;
        };

        const edgeReducer = (edge, data) => {
            if (data.hidden) return { ...data, hidden: true };

            let color = data.color;

            if (config && config.colors && config.colors.edges) {
                const edgesConfig = config.colors.edges;

                if (data.kind === 'tag') {
                    // Tag edges
                    // Check if source/target is tag? 
                    // Actually json_to_sigma sets kind='tag' for tag edges.
                    // But let's be safe and check if tag_edge_color exists.
                    if (edgesConfig.tag_edge_color) {
                        color = edgesConfig.tag_edge_color;
                    }
                } else if (data.kind === 'explicit') {
                    // Explicit edges
                    if (data.directed && edgesConfig.direct_color) {
                        color = edgesConfig.direct_color;
                    } else if (edgesConfig.explicit_color) {
                        color = edgesConfig.explicit_color;
                    }
                } else if (data.kind === 'inferred' || data.kind === 'similarity') {
                    // Inferred edges - use buckets
                    const sim = data.similarity || 0;
                    let bucketColor = edgesConfig.default_inferred_color;

                    if (edgesConfig.similarity_buckets) {
                        // Find matching bucket
                        const bucket = edgesConfig.similarity_buckets.find(b => sim >= b.min);
                        if (bucket) {
                            bucketColor = bucket.color;
                        }
                    }
                    color = bucketColor;
                }
            }

            if (hoveredNode) {
                const source = graph.source(edge);
                const target = graph.target(edge);
                // Check if edge is connected to hoveredNode
                const isConnected = source === hoveredNode || target === hoveredNode;

                if (isConnected) {
                    return { ...data, color, zIndex: 10 };
                } else {
                    // Dim non-connected edges
                    const isDark = isDarkModeRef.current;
                    return {
                        ...data,
                        color: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.05)",
                        zIndex: 0
                    };
                }
            }
            return { ...data, color };
        };

        // 3. Initialize Sigma
        // CRITICAL: Clear container to prevent renderer leaks (multiple canvases)
        // We also check if there's an existing renderer in the ref and kill it just in case
        if (rendererRef.current) {
            console.warn("GraphViewer: Found existing renderer in ref during init. Killing it.");
            try {
                rendererRef.current.kill();
            } catch (e) {
                console.error("GraphViewer: Error killing existing renderer:", e);
            }
        }

        // Manually remove all children to be safe
        while (containerRef.current.firstChild) {
            containerRef.current.removeChild(containerRef.current.firstChild);
        }

        // Sigma instance creation
        let renderer;
        try {
            renderer = new Sigma(graph, containerRef.current, {
                renderer: "canvas",
                nodeReducer,
                edgeReducer,
                // Configure label colors for dark mode (fallback)
                labelColor: { color: isDarkMode ? "#ffffff" : "#000000" },

                // Custom label renderer to handle hover background colors
                labelRenderer: (ctx, data) => {
                    // Always use current dark mode for color
                    const isDark = isDarkModeRef.current;

                    const fontSize = Math.max(data.size / 2, 12);
                    const x = data.x + data.size + 5;
                    const y = data.y + fontSize / 3;

                    if (data.highlighted) {
                        // Hover state rendering

                        // Hover state
                        // DEBUG: Force RED background to verify we have control
                        const bgColor = "#ff0000"; // RED
                        // const bgColor = isDark ? "#000000" : "#ffffff";
                        const textColor = isDark ? "#ffffff" : "#000000";

                        ctx.font = `bold ${fontSize}px Arial`;
                        const width = ctx.measureText(data.label).width;

                        // Draw background rectangle
                        ctx.fillStyle = bgColor;
                        // Add some padding
                        const pad = 4;
                        ctx.fillRect(x - pad / 2, y - fontSize, width + pad, fontSize + pad);

                        // Draw text
                        ctx.fillStyle = textColor;
                        ctx.fillText(data.label, x, y);
                    } else {
                        // Normal state
                        // Dark Mode: White text
                        // Light Mode: Black text
                        ctx.font = `${fontSize}px Arial`;
                        ctx.fillStyle = isDark ? "#ffffff" : "#000000";
                        ctx.fillText(data.label, x, y);
                    }
                },
                // Correct way to customize hover in Sigma.js v3:
                // Override defaultDrawNodeHover
                defaultDrawNodeHover: (context, data, settings) => {
                    const size = settings.labelSize;
                    const font = settings.labelFont;
                    const weight = settings.labelWeight;

                    context.font = `${weight} ${size}px ${font}`;
                    context.fillStyle = "#FFF";

                    // Label background
                    // Dark Mode: Black background, White text
                    // Light Mode: White background, Black text
                    const isDark = isDarkModeRef.current;

                    // 1. Label background: Black in dark mode
                    // 2. Node border: NOT black (so we use White to mask edges/stand out)
                    const labelBgColor = isDark ? "#000000" : "#ffffff";
                    // Use dynamic border color if available, otherwise white
                    const nodeBorderColor = data.borderColor || "#ffffff";
                    const textColor = isDark ? "#ffffff" : "#000000";

                    // Draw node circle (Border/Mask)
                    context.fillStyle = nodeBorderColor;
                    context.beginPath();
                    context.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2, true);
                    context.closePath();
                    context.fill();

                    // Draw label
                    if (data.label) {
                        const width = context.measureText(data.label).width;
                        const x = Math.round(data.x);
                        const y = Math.round(data.y);
                        const w = Math.round(width + size / 2 + data.size + 3);
                        const h = Math.round(size + 4);
                        const e = Math.round(size / 2 + 2);

                        // Draw label background
                        context.fillStyle = labelBgColor;
                        context.beginPath();
                        context.moveTo(x, y + e);
                        context.arcTo(x, y, x + e, y, e);
                        context.lineTo(x + w, y);
                        context.lineTo(x + w, y + h);
                        context.lineTo(x + e, y + h);
                        context.arcTo(x, y + h, x, y + h - e, e);
                        context.lineTo(x, y + e);
                        context.closePath();
                        context.fill();

                        // Draw text
                        context.fillStyle = textColor;
                        context.fillText(data.label, x + data.size + 3, y + size / 3);
                    }
                },

            });

            // Assign unique ID for debugging
            renderer.customId = Math.random().toString(36).substr(2, 9);

            // Expose globally for debugging and fallback
            window.sigmaRenderer = renderer;

            // Set initial camera position to be well-centered
            renderer.getCamera().setState({ x: 0.5, y: 0.4, ratio: 1.4 });

        } catch (e) {
            console.error("GraphViewer: Error creating Sigma instance:", e);
            return;
        }

        rendererRef.current = renderer;
        if (setRendererInstance) setRendererInstance(renderer);


        // 4. Event Listeners
        let draggedNode = null;

        renderer.on("enterNode", (e) => {
            hoveredNode = e.node;
            hoverDistances = {};
            hoverDistances[e.node] = 0;
            graph.forEachNeighbor(e.node, n => {
                hoverDistances[n] = 1;
            });
            renderer.refresh();
            if (onNodeHover) onNodeHover(e.node);
            containerRef.current.style.cursor = "pointer";
        });

        renderer.on("leaveNode", () => {
            hoveredNode = null;
            hoverDistances = {};
            renderer.refresh();
            if (onNodeHover) onNodeHover(null);
            containerRef.current.style.cursor = "default";
        });

        renderer.on("clickNode", (e) => {
            // Cmd/Ctrl+Click to open Notion URL
            if (e.event.original.metaKey || e.event.original.ctrlKey) {
                const nodeData = graph.getNodeAttributes(e.node);
                const url = nodeData.url;
                if (url && nodeData.kind !== 'tag') {
                    window.open(url, '_blank');
                    return;
                }
            }
            if (onNodeClick) onNodeClick(e.node);
        });

        // Dragging Logic
        renderer.on("downNode", (e) => {
            draggedNode = e.node;
            renderer.getCamera().disable();
        });

        const handleMouseMove = (e) => {
            if (!draggedNode) return;

            // Get new position from mouse
            // We need to subtract the container offset if not full screen, but renderer.viewportToGraph handles client coords usually?
            // Actually renderer.viewportToGraph takes {x, y} relative to the viewport.
            // If the container is not the whole body, we might need to adjust.
            // Sigma's viewportToGraph usually expects coordinates relative to the canvas/container.

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const pos = renderer.viewportToGraph({ x, y });

            graph.setNodeAttribute(draggedNode, "x", pos.x);
            graph.setNodeAttribute(draggedNode, "y", pos.y);

            // Prevent default to avoid selecting text etc
            e.preventDefault();
        };

        const handleMouseUp = () => {
            if (draggedNode) {
                draggedNode = null;
                renderer.getCamera().enable();
            }
        };

        // Edge hover detection
        const handleCanvasMouseMove = (e) => {
            if (!containerRef.current || renderer.killed) return;

            const rect = containerRef.current.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const graphPos = renderer.viewportToGraph({ x, y });

            // Find closest edge
            let closestEdge = null;
            let minDist = 10; // pixels threshold

            graph.forEachEdge((edge, attrs, source, target) => {
                if (attrs.hidden) return;

                const sourcePos = graph.getNodeAttributes(source);
                const targetPos = graph.getNodeAttributes(target);
                const camera = renderer.getCamera();

                // Convert graph coords to viewport
                const sx = sourcePos.x;
                const sy = sourcePos.y;
                const tx = targetPos.x;
                const ty = targetPos.y;

                // Calculate distance from point to line segment
                const dx = tx - sx;
                const dy = ty - sy;
                const len2 = dx * dx + dy * dy;
                if (len2 === 0) return;

                let t = ((graphPos.x - sx) * dx + (graphPos.y - sy) * dy) / len2;
                t = Math.max(0, Math.min(1, t));

                const projX = sx + t * dx;
                const projY = sy + t * dy;
                const dist = Math.sqrt((graphPos.x - projX) ** 2 + (graphPos.y - projY) ** 2);

                // Convert distance to viewport pixels
                const viewportDist = dist * camera.ratio;

                if (viewportDist < minDist) {
                    minDist = viewportDist;
                    closestEdge = { edge, attrs, x: e.clientX, y: e.clientY };
                }
            });

            if (closestEdge) {
                // Try different possible fields for edge reasons
                const reasons = closestEdge.attrs.reasons || closestEdge.attrs.reason || [];
                const reasonText = Array.isArray(reasons) ? reasons.join('; ') : (reasons || 'Connection');
                setEdgeTooltip({ x, y, text: reasonText });
            } else {
                setEdgeTooltip(null);
            }
        };

        // Keyboard shortcuts
        const handleKeyDown = (e) => {
            if (renderer.killed) return;
            const camera = renderer.getCamera();
            if (!camera) return;

            // Cmd/Ctrl+0 to center
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault();
                camera.animate({ x: 0.5, y: 0.4, ratio: 1.4 }, { duration: 700 });
                return;
            }

            // +/- for zoom (also handle = for + without shift)
            if (e.key === '+' || e.key === '=') {
                e.preventDefault();
                camera.animatedZoom({ duration: 300 });
                return;
            }
            if (e.key === '-' || e.key === '_') {
                e.preventDefault();
                camera.animatedUnzoom({ duration: 300 });
                return;
            }

            // Arrow keys for pan
            const state = camera.getState();
            // Move 2 screen pixels per key press (adjusted by ratio)
            // Extremely conservative to prevent jumping.
            const PAN_STEP = 0.05 * state.ratio;

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                camera.animate({ ...state, y: state.y - PAN_STEP }, { duration: 50 });
                return;
            }
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                camera.animate({ ...state, y: state.y + PAN_STEP }, { duration: 50 });
                return;
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                camera.animate({ ...state, x: state.x + PAN_STEP }, { duration: 50 });
                return;
            }
            if (e.key === 'ArrowRight') {
                e.preventDefault();
                camera.animate({ ...state, x: state.x - PAN_STEP }, { duration: 50 });
                return;
            }
        };

        // Attach global mouse listeners to handle dragging outside the node
        // We attach to document to catch mouseup outside canvas
        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
        document.addEventListener("keydown", handleKeyDown);
        containerRef.current.addEventListener("mousemove", handleCanvasMouseMove);

        // 5. Resize Observer
        const resizeObserver = new ResizeObserver(() => {
            if (renderer && !renderer.killed) {
                renderer.resize();
                renderer.refresh();
            }
        });
        resizeObserver.observe(containerRef.current);

        // Cleanup
        return () => {
            // Cleaning up renderer
            resizeObserver.disconnect();
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("keydown", handleKeyDown);
            if (containerRef.current) {
                containerRef.current.removeEventListener("mousemove", handleCanvasMouseMove);
            }
            if (setRendererInstance) setRendererInstance(null);

            try {
                renderer.kill();
                // Renderer killed successfully
            } catch (e) {
                console.error("GraphViewer: Error killing renderer during cleanup:", e);
            }
            rendererRef.current = null;
        };
    }, [graphData, isDarkMode, setRendererInstance, config]); // Re-init if data or dark mode changes (simple approach)

    // Handle Filters (Effect)
    useEffect(() => {
        const graph = graphRef.current;
        const renderer = rendererRef.current;
        if (!graph || !renderer) return;

        // Apply filters logic using shared utility
        const { visibleNodes, visibleEdges } = applyFilters(graph, filters);

        graph.forEachNode((node) => {
            graph.setNodeAttribute(node, "hidden", !visibleNodes.has(node));
        });

        graph.forEachEdge((edge) => {
            graph.setEdgeAttribute(edge, "hidden", !visibleEdges.has(edge));
        });

        renderer.refresh();

    }, [filters, graphData]); // Re-run when filters change

    return (
        <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
            {edgeTooltip && (
                <div
                    style={{
                        position: 'absolute',
                        left: edgeTooltip.x + 10,
                        top: edgeTooltip.y + 10,
                        background: isDarkMode ? '#333' : '#fff',
                        color: isDarkMode ? '#fff' : '#000',
                        padding: '8px 12px',
                        borderRadius: '4px',
                        border: `1px solid ${isDarkMode ? '#555' : '#ccc'} `,
                        pointerEvents: 'none',
                        zIndex: 1000,
                        maxWidth: '300px',
                        fontSize: '12px',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
                    }}
                >
                    {edgeTooltip.text}
                </div>
            )}
        </div>
    );
});
