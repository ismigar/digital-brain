
export function applyFilters(graph, filters) {
    const {
        activeClusters = new Set(),
        activeKinds = new Set(),
        activeProjects = new Set(),
        similarity = 0,
        hideIsolated = false,
        onlyIsolated = false,
        selectedNode = null,
        depth = 1,
        searchTerm = ""
    } = filters;

    const visibleNodes = new Set();
    const visibleEdges = new Set();

    if (selectedNode) {
        // Depth mode logic
        const maxDepth = Number(depth);
        const queue = [{ node: selectedNode, d: 0 }];
        visibleNodes.add(selectedNode);

        while (queue.length > 0) {
            const { node, d } = queue.shift();

            if (d >= maxDepth) continue;

            const neighbors = graph.neighbors(node);
            neighbors.forEach((neighbor) => {
                if (!visibleNodes.has(neighbor)) {
                    const nextDepth = d + 1;
                    if (nextDepth <= maxDepth) {
                        visibleNodes.add(neighbor);
                        queue.push({ node: neighbor, d: nextDepth });
                    }
                }
            });
        }

        graph.forEachEdge((edge, attrs, source, target) => {
            if (visibleNodes.has(source) && visibleNodes.has(target)) {
                visibleEdges.add(edge);
            }
        });

    } else {
        // Normal filter mode
        const clusterFiltersLower = new Set(Array.from(activeClusters).map(c => c.toLowerCase()));
        const kindFiltersLower = new Set(Array.from(activeKinds).map(k => k.toLowerCase()));
        const projectFiltersLower = new Set(Array.from(activeProjects).map(p => p.toLowerCase()));

        graph.forEachNode((node, attrs) => {
            let matchCluster = true;
            if (clusterFiltersLower.size > 0) {
                const allTagsLower = [
                    (attrs.cluster || "").toLowerCase(),
                    ...((attrs.clusters_extra || []).map(t => (t || "").toLowerCase()))
                ].filter(Boolean);
                matchCluster = allTagsLower.some(t => clusterFiltersLower.has(t));
            }

            const nodeKind = (attrs.kind || "").toLowerCase();
            const matchKind = kindFiltersLower.size === 0 || kindFiltersLower.has(nodeKind);

            const nodeProject = (attrs.project || "").toLowerCase();
            const matchProject = projectFiltersLower.size === 0 || projectFiltersLower.has(nodeProject);

            const isIsolated = graph.degree(node) === 0;
            let isNodeVisible;

            if (onlyIsolated) {
                isNodeVisible = isIsolated &&
                    (clusterFiltersLower.size === 0 || matchCluster) &&
                    (kindFiltersLower.size === 0 || matchKind) &&
                    (projectFiltersLower.size === 0 || matchProject);
            } else {
                const matchIsolated = !hideIsolated || !isIsolated;

                // Search Term Filter
                let matchSearch = true;
                if (searchTerm && searchTerm.trim() !== "") {
                    const term = searchTerm.toLowerCase().trim();
                    const label = (attrs.label || "").toLowerCase();
                    // You can extend this to search in other attributes if needed
                    matchSearch = label.includes(term);
                }

                isNodeVisible = matchCluster && matchKind && matchProject && matchIsolated && matchSearch;
            }

            if (isNodeVisible) {
                visibleNodes.add(node);
            }
        });

        // Edge filtering
        graph.forEachEdge((edge, attrs, source, target) => {
            const sourceHidden = !visibleNodes.has(source);
            const targetHidden = !visibleNodes.has(target);
            const sim = attrs.similarity !== undefined ? Number(attrs.similarity) : 100;
            const filterSim = Number(similarity);
            const isEdgeVisible = !sourceHidden && !targetHidden && sim >= filterSim;

            if (filterSim === 100 && isEdgeVisible && sim < 100) {
                console.log("BUG DETECTED: Edge visible with sim < 100", { edge, attrs, sim, filterSim });
            }

            if (isEdgeVisible) {
                visibleEdges.add(edge);
            }
        });
    }

    return { visibleNodes, visibleEdges };
}
