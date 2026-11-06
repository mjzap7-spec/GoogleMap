// Kept as source text so the WebView can execute it on Hermes and web.
export const crowdLayoutSource = String.raw`function clusterProjectedPeople(points, initialRadius, budget = 32) {
    let radius = initialRadius;
    let result = [];
    for (let attempt = 0; attempt < 12; attempt++) {
        const parents = points.map((_, index) => index);
        function root(index) {
            while (parents[index] !== index) {
                parents[index] = parents[parents[index]];
                index = parents[index];
            }
            return index;
        }
        const cells = new Map();
        points.forEach((point, index) => {
            const cellX = Math.floor(point.x / radius);
            const cellY = Math.floor(point.y / radius);
            for (let dx = -1; dx <= 1; dx++)
                for (let dy = -1; dy <= 1; dy++) {
                    const bucket = cells.get(cellX + dx + ',' + (cellY + dy));
                    if (!bucket) continue;
                    // Once an entire cell is connected, one link reaches all of its points.
                    if (bucket.connected && root(index) === root(bucket.indices[0])) continue;
                    for (const other of bucket.indices) {
                        if (root(index) === root(other)) continue;
                        const distanceX = point.x - points[other].x;
                        const distanceY = point.y - points[other].y;
                        if (distanceX * distanceX + distanceY * distanceY < radius * radius) {
                            parents[root(index)] = root(other);
                            if (bucket.connected) break;
                        }
                    }
                }
            const key = cellX + ',' + cellY;
            const bucket = cells.get(key);
            if (bucket) {
                bucket.connected = bucket.connected && root(index) === root(bucket.indices[0]);
                bucket.indices.push(index);
            } else {
                cells.set(key, { indices: [index], connected: true });
            }
        });
        const groups = new Map();
        points.forEach((point, index) => {
            const key = root(index);
            const group = groups.get(key) ?? { ids: [], x: 0, y: 0 };
            group.ids.push(point.id);
            group.x += point.x;
            group.y += point.y;
            groups.set(key, group);
        });
        result = Array.from(groups.values()).map((group) => ({
            ids: group.ids,
            x: group.x / group.ids.length,
            y: group.y / group.ids.length,
        }));
        if (result.length <= budget)
            return result;
        radius *= 1.5;
    }
    // Preserve every identity even for pathological coordinates or very large viewports.
    return [
        {
            ids: points.map((point) => point.id),
            x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
            y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
        },
    ];
}`;
