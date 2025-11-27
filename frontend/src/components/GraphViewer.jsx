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
    isDarkMode
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
            if (camera) camera.animate({ x: 0, y: 0, ratio: 1 }, { duration: 700 });
        },
        fullscreen: () => {
            if (containerRef.current) {
                if (document.fullscreenElement !== containerRef.current) {
                    containerRef.current.requestFullscreen();
                } else {
                    document.exitFullscreen();
                }
            }
        }
    }));

    // Initialize Graph and Sigma
    useEffect(() => {
        if (!graphData || !containerRef.current) return;

        // 1. Create Graph
        const graph = new Graph();
        graphData.nodes.forEach(n => graph.addNode(String(n.key), n));
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
            // Force node (and label) color to white for visibility in dark mode
            // res.color = "#ffffff"; // Removed to restore node colors
            // Always show labels
            res.label = data.label;

            if (hoveredNode) {
                const d = hoverDistances[node] ?? 99;
                res.opacity = d === 0 ? 1 : d === 1 ? 0.6 : d === 2 ? 0.25 : 0.08;
                res.size = d <= 1 ? data.size : data.size * 0.5;
                // Only show labels for hovered node and immediate neighbors when hovering
                res.label = d <= 1 ? data.label : "";
                if (node === hoveredNode) res.highlighted = true;
            }
            return res;
        };

        const edgeReducer = (edge, data) => {
            if (data.hidden) return { ...data, hidden: true };
            if (!hoveredNode) return data;
            return { ...data, color: data.color, hidden: false };
        };

        // 3. Initialize Sigma
        const renderer = new Sigma(graph, containerRef.current, {
            renderer: "canvas",
            nodeReducer,
            edgeReducer,
            defaultLabelColor: "#ffffff",
            labelRenderer: (ctx, data) => {
                const fontSize = Math.max(data.size / 2, 12);
                const x = data.x + data.size + 5;
                const y = data.y + fontSize / 3;
                if (data.highlighted) {
                    // Hover state: white background with black text in dark mode
                    const isDark = isDarkModeRef.current;
                    const bgColor = isDark ? "#ffffff" : "#000000";
                    const textColor = isDark ? "#000000" : "#ffffff";
                    ctx.font = `bold ${fontSize}px Arial`;
                    const width = ctx.measureText(data.label).width;
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(x - 2, y - fontSize, width + 4, fontSize + 4);
                    ctx.fillStyle = textColor;
                    ctx.fillText(data.label, x, y);
                } else {
                    // Normal state: white text
                    ctx.fillStyle = "#ffffff";
                    ctx.font = `${fontSize}px Arial`;
                    ctx.fillText(data.label, x, y);
                }
            },
            renderLabels: true,
            defaultEdgeColor: "#ffffff",
            edgeRenderer: (ctx, data, sourceData, targetData) => {
                const sx = sourceData.x;
                const sy = sourceData.y;
                const tx = targetData.x;
                const ty = targetData.y;
                const color = data.color || "#999";
                const size = data.size || 1;

                ctx.strokeStyle = color;
                ctx.lineWidth = size;

                if (data.dashed) ctx.setLineDash([6, 4]);
                else ctx.setLineDash([]);

                ctx.beginPath();
                ctx.moveTo(sx, sy);
                ctx.lineTo(tx, ty);
                ctx.stroke();

                if (data.directed) {
                    const angle = Math.atan2(ty - sy, tx - sx);
                    const arrowSize = 10 + size * 2;
                    ctx.beginPath();
                    ctx.moveTo(tx, ty);
                    ctx.lineTo(
                        tx - arrowSize * Math.cos(angle - Math.PI / 6),
                        ty - arrowSize * Math.sin(angle - Math.PI / 6)
                    );
                    ctx.lineTo(
                        tx - arrowSize * Math.cos(angle + Math.PI / 6),
                        ty - arrowSize * Math.sin(angle + Math.PI / 6)
                    );
                    ctx.fillStyle = color;
                    ctx.fill();
                }
            }
        });

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
            if (!containerRef.current) return;

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
            const camera = renderer.getCamera();
            if (!camera) return;

            // Cmd/Ctrl+0 to center
            if ((e.metaKey || e.ctrlKey) && e.key === '0') {
                e.preventDefault();
                camera.animate({ x: 0, y: 0, ratio: 1 }, { duration: 700 });
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

        // Cleanup
        return () => {
            document.removeEventListener("mousemove", handleMouseMove);
            document.removeEventListener("mouseup", handleMouseUp);
            document.removeEventListener("keydown", handleKeyDown);
            if (containerRef.current) {
                containerRef.current.removeEventListener("mousemove", handleCanvasMouseMove);
            }
            renderer.kill();
        };
    }, [graphData, isDarkMode]); // Re-init if data or dark mode changes (simple approach)

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
                        border: `1px solid ${isDarkMode ? '#555' : '#ccc'}`,
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
