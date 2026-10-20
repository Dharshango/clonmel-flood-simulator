export function exportPeakDepthMap(simulator, meta, buildingsData, roadsData, scenarioName = '1-in-100-Year Flood') {
    const gridW = meta.grid_w;
    const gridH = meta.grid_h;
    const bbox = meta.bbox;
    const width_m = meta.width_m;
    const height_m = meta.height_m;
    
    simulator.updateReadback();
    const buf = simulator.readbackBuffer;
    
    // Create high-res export canvas (1800 x 1200)
    const canvas = document.createElement('canvas');
    canvas.width = 1800;
    canvas.height = 1200;
    const ctx = canvas.getContext('2d');
    
    // Map frame area
    const mapX = 60;
    const mapY = 100;
    const mapW = 1680;
    const mapH = 920;
    
    // Background: deep obsidian slate
    ctx.fillStyle = '#0a0e17';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw map background (black ground terrain)
    ctx.fillStyle = '#060910';
    ctx.fillRect(mapX, mapY, mapW, mapH);
    
    // Offscreen image for peak depth raster
    const rasterCanvas = document.createElement('canvas');
    rasterCanvas.width = gridW;
    rasterCanvas.height = gridH;
    const rCtx = rasterCanvas.getContext('2d');
    const imgData = rCtx.createImageData(gridW, gridH);
    
    let maxObservedPeak = 0.0;
    let floodedCellCount = 0;
    
    function depthToColor(d) {
        if (d < 0.05) return [0, 0, 0, 0]; // dry
        if (d < 0.5) {
            const t = (d - 0.05) / 0.45;
            return [Math.round(20 + 20 * t), Math.round(180 + 40 * t), Math.round(230 - 30 * t), 210];
        } else if (d < 1.5) {
            const t = (d - 0.5) / 1.0;
            return [Math.round(40 + 120 * t), Math.round(100 - 40 * t), Math.round(220 + 20 * t), 235];
        } else {
            const t = Math.min(1.0, (d - 1.5) / 1.5);
            return [Math.round(220 + 35 * t), Math.round(50 + 100 * (1 - t)), 30, 250];
        }
    }
    
    for (let gy = 0; gy < gridH; gy++) {
        const bufY = gridH - 1 - gy;
        for (let gx = 0; gx < gridW; gx++) {
            const bufIdx = (bufY * gridW + gx) * 4;
            const peakH = buf[bufIdx + 3];
            if (peakH > maxObservedPeak) maxObservedPeak = peakH;
            if (peakH >= 0.08) floodedCellCount++;
            
            const pixIdx = (gy * gridW + gx) * 4;
            const rgba = depthToColor(peakH);
            imgData.data[pixIdx + 0] = rgba[0];
            imgData.data[pixIdx + 1] = rgba[1];
            imgData.data[pixIdx + 2] = rgba[2];
            imgData.data[pixIdx + 3] = rgba[3];
        }
    }
    
    rCtx.putImageData(imgData, 0, 0);
    
    // Draw streets onto map
    ctx.save();
    ctx.beginPath();
    ctx.rect(mapX, mapY, mapW, mapH);
    ctx.clip();
    
    const w_deg = bbox.east - bbox.west;
    const h_deg = bbox.north - bbox.south;
    
    function toCanvas(lon, lat) {
        const x = mapX + ((lon - bbox.west) / w_deg) * mapW;
        const y = mapY + ((bbox.north - lat) / h_deg) * mapH;
        return { x, y };
    }
    
    // Draw roads background
    ctx.strokeStyle = '#27354a';
    ctx.lineWidth = 1.5;
    for (let r of roadsData) {
        if (!r.pts || r.pts.length < 2) continue;
        ctx.beginPath();
        const start = toCanvas(r.pts[0][0], r.pts[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < r.pts.length; i++) {
            const pt = toCanvas(r.pts[i][0], r.pts[i][1]);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.stroke();
    }
    
    // Draw depth raster overlay
    ctx.drawImage(rasterCanvas, mapX, mapY, mapW, mapH);
    
    // Draw gray buildings outlines
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 0.8;
    for (let b of buildingsData) {
        if (!b.pts || b.pts.length < 3) continue;
        ctx.beginPath();
        const start = toCanvas(b.pts[0][0], b.pts[0][1]);
        ctx.moveTo(start.x, start.y);
        for (let i = 1; i < b.pts.length; i++) {
            const pt = toCanvas(b.pts[i][0], b.pts[i][1]);
            ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    // Draw prominent street labels
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 12px Inter, sans-serif';
    const prominent = ['The Quay', 'Quay Street', 'O\'Connell Street', 'Old Bridge', 'Gladstone Street', 'Davis Road', 'Irishtown'];
    for (let r of roadsData) {
        if (prominent.includes(r.name) && r.pts && r.pts.length > 2) {
            const mid = r.pts[Math.floor(r.pts.length / 2)];
            const pos = toCanvas(mid[0], mid[1]);
            ctx.fillText(r.name, pos.x + 4, pos.y - 4);
        }
    }
    
    ctx.restore();
    
    // Map Border
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2;
    ctx.strokeRect(mapX, mapY, mapW, mapH);
    
    // Title Header Block
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 26px Inter, sans-serif';
    ctx.fillText('CLONMEL & RIVER SUIR FLOOD HAZARD SIMULATION', mapX, 48);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '15px Inter, sans-serif';
    ctx.fillText(`Scenario: ${scenarioName} | Bounding Box: 52.345°N - 52.364°N, 7.730°W - 7.680°W (~3.4 km x 2.1 km)`, mapX, 76);
    
    // Footer / Scale Bar & North Arrow
    const footerY = 1050;
    
    // Colorbar Legend
    const legX = mapX + 40;
    const legY = footerY + 15;
    const legW = 360;
    const legH = 18;
    
    const grad = ctx.createLinearGradient(legX, 0, legX + legW, 0);
    grad.addColorStop(0.0, '#10b981'); // 0m
    grad.addColorStop(0.2, '#38bdf8'); // 0.5m
    grad.addColorStop(0.5, '#3b82f6'); // 1.2m
    grad.addColorStop(0.8, '#f59e0b'); // 2.0m
    grad.addColorStop(1.0, '#ef4444'); // 3.0m+
    
    ctx.fillStyle = grad;
    ctx.fillRect(legX, legY, legW, legH);
    ctx.strokeStyle = '#64748b';
    ctx.strokeRect(legX, legY, legW, legH);
    
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText('Peak Inundation Depth:', legX, legY - 8);
    ctx.fillText('0.05m', legX - 5, legY + 34);
    ctx.fillText('0.5m', legX + legW * 0.25 - 12, legY + 34);
    ctx.fillText('1.5m', legX + legW * 0.60 - 12, legY + 34);
    ctx.fillText('3.0m+', legX + legW - 15, legY + 34);
    
    // Graphic Scale Bar (500m)
    const scaleBarX = mapX + 600;
    const scaleBarMeters = 500;
    const scaleBarPixels = (scaleBarMeters / width_m) * mapW;
    
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(scaleBarX, legY + 10);
    ctx.lineTo(scaleBarX + scaleBarPixels, legY + 10);
    ctx.moveTo(scaleBarX, legY + 2);
    ctx.lineTo(scaleBarX + scaleBarPixels, legY + 18);
    ctx.moveTo(scaleBarX + scaleBarPixels, legY + 2);
    ctx.lineTo(scaleBarX + scaleBarPixels, legY + 18);
    ctx.stroke();
    
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.fillText('500 meters', scaleBarX + scaleBarPixels * 0.5 - 35, legY - 6);
    
    // North Arrow
    const naX = mapX + mapW - 80;
    const naY = legY + 5;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.moveTo(naX, naY - 24);
    ctx.lineTo(naX - 10, naY + 14);
    ctx.lineTo(naX, naY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(naX, naY - 24);
    ctx.lineTo(naX + 10, naY + 14);
    ctx.lineTo(naX, naY + 6);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText('N', naX - 5, naY - 30);
    
    // Summary statistics in bottom right
    const floodedAreaSqM = floodedCellCount * meta.dx * meta.dy;
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(`Peak Depth: ${maxObservedPeak.toFixed(2)} m`, scaleBarX + 280, legY);
    ctx.fillText(`Inundated Area: ${(floodedAreaSqM / 10000.0).toFixed(1)} hectares`, scaleBarX + 280, legY + 20);
    ctx.fillText(`Model: 2D SWE GPU (600x400 grid, dx=${meta.dx.toFixed(1)}m)`, scaleBarX + 280, legY + 40);
    
    const dataUrl = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `clonmel_peak_flood_map_${Date.now()}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    return dataUrl;
}
