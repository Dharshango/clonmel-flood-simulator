import re

with open('src/main.js', 'r', encoding='utf-8') as f:
    c = f.read()

# 1. Update drawing setup around line 438
old_setup = '''    const vertexMarkerGeom = new THREE.SphereGeometry(1.2, 16, 16);
    const wallVertexMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8
    });
    const sandbagVertexMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.6
    });

    let isDrawingMode = false;
    let currentDrawingPoints = []; // [[lon, lat], ...]
    let currentDrawingWorldPoints = []; // [THREE.Vector3, ...]
    let drawnVertexMeshes = [];
    let totalDrawnLengthMeters = 0;'''

new_setup = '''    const vertexMarkerGeom = new THREE.SphereGeometry(1.0, 16, 16);
    const wallVertexMat = new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 0.85,
        roughness: 0.2,
        metalness: 0.8
    });
    const sandbagVertexMat = new THREE.MeshStandardMaterial({
        color: 0xf59e0b,
        emissive: 0xd97706,
        emissiveIntensity: 0.85,
        roughness: 0.3,
        metalness: 0.6
    });

    // Real-Time 3D Freehand Polyline Tracer
    const maxFreehandPoints = 2500;
    const freehandLineGeom = new THREE.BufferGeometry();
    const freehandLinePositions = new Float32Array(maxFreehandPoints * 3);
    freehandLineGeom.setAttribute('position', new THREE.BufferAttribute(freehandLinePositions, 3));
    freehandLineGeom.setDrawRange(0, 0);
    const freehandLineMat = new THREE.LineBasicMaterial({
        color: 0x38bdf8,
        linewidth: 4,
        transparent: true,
        opacity: 0.95
    });
    const freehandLine = new THREE.Line(freehandLineGeom, freehandLineMat);
    freehandLine.frustumCulled = false;
    freehandLine.visible = false;
    drawingGroup.add(freehandLine);

    let isDrawingMode = false;
    let isFreehandDrawing = false;
    let currentDrawingPoints = []; // [[lon, lat], ...]
    let currentDrawingWorldPoints = []; // [THREE.Vector3, ...]
    let drawnVertexMeshes = [];
    let totalDrawnLengthMeters = 0;'''

# 2. Update cleanupDrawingVisuals, startDrawingMode, stopDrawingMode, addDrawingPoint
old_drawing_funcs = '''    function cleanupDrawingVisuals() {
        rubberBandLine.visible = false;
        cursorRing.visible = false;
        for (const m of drawnVertexMeshes) {
            drawingGroup.remove(m);
            if (m.geometry) m.geometry.dispose();
        }
        drawnVertexMeshes = [];
    }

    function startDrawingMode() {
        if (activeBarrierTool === 'preset') {
            selectBarrierTool('wall');
        }
        isDrawingMode = true;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.add('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Drawing Wall Active...' : 'Drawing Sandbag Active...';
        }
        if (drawActiveActions) drawActiveActions.classList.remove('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.remove('hidden');
        if (drawVertexCount) drawVertexCount.textContent = '0';

        const crestH = barrierHeightInput ? barrierHeightInput.value : (activeBarrierTool === 'wall' ? '2.8' : '1.2');
        const depthD = barrierDepthInput ? barrierDepthInput.value : (activeBarrierTool === 'wall' ? '2.0' : '1.0');

        if (drawingHudBanner) {
            drawingHudBanner.classList.remove('hidden');
            if (hudBannerTitle) hudBannerTitle.textContent = activeBarrierTool === 'wall' ? 'DRAWING FLOOD WALL ON 3D MAP' : 'DRAWING SANDBAG BUND ON 3D MAP';
            if (hudVertexCount) hudVertexCount.textContent = '0';
            if (hudLengthCount) hudLengthCount.textContent = '0.0 m';
            if (hudCrestVal) hudCrestVal.textContent = `${crestH}m`;
            if (hudDepthVal) hudDepthVal.textContent = `${depthD}m`;
        }
        canvas.style.cursor = 'crosshair';
    }

    function stopDrawingMode() {
        isDrawingMode = false;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.remove('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Draw Wall on Map' : 'Draw Sandbag on Map';
        }
        if (drawActiveActions) drawActiveActions.classList.add('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.add('hidden');
        if (drawingHudBanner) drawingHudBanner.classList.add('hidden');
        canvas.style.cursor = 'default';
    }'''

new_drawing_funcs = '''    function cleanupDrawingVisuals() {
        rubberBandLine.visible = false;
        cursorRing.visible = false;
        freehandLine.visible = false;
        freehandLineGeom.setDrawRange(0, 0);
        for (const m of drawnVertexMeshes) {
            drawingGroup.remove(m);
            if (m.geometry) m.geometry.dispose();
        }
        drawnVertexMeshes = [];
    }

    function addDrawingPoint(pt) {
        if (currentDrawingWorldPoints.length > 0) {
            const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
            const dist = Math.hypot(pt.x - lastPt.x, pt.z - lastPt.z);
            if (dist < 1.4) return false; // Smooth adaptive sampling threshold
            totalDrawnLengthMeters += dist;
        }

        const u = (pt.x / meta.width_m) + 0.5;
        const v = -(pt.z / meta.height_m) + 0.5;
        const lon = meta.bbox.west + u * (meta.bbox.east - meta.bbox.west);
        const lat = meta.bbox.south + v * (meta.bbox.north - meta.bbox.south);

        currentDrawingPoints.push([lon, lat]);
        const wPt = new THREE.Vector3(pt.x, pt.y + 0.45, pt.z);
        currentDrawingWorldPoints.push(wPt);

        // Update real-time continuous freehand 3D line
        const idx = currentDrawingWorldPoints.length - 1;
        if (idx < maxFreehandPoints) {
            freehandLinePositions[idx * 3] = wPt.x;
            freehandLinePositions[idx * 3 + 1] = wPt.y + 0.25;
            freehandLinePositions[idx * 3 + 2] = wPt.z;
            freehandLineGeom.attributes.position.needsUpdate = true;
            freehandLineGeom.setDrawRange(0, idx + 1);
            freehandLine.visible = true;
        }

        // Add periodic glowing vertex markers along stroke
        if (idx === 0 || idx % 4 === 0) {
            const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;
            const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);
            markerMesh.position.set(pt.x, pt.y + 0.5, pt.z);
            drawingGroup.add(markerMesh);
            drawnVertexMeshes.push(markerMesh);
        }

        const count = currentDrawingPoints.length;
        if (drawVertexCount) drawVertexCount.textContent = count;
        if (hudVertexCount) hudVertexCount.textContent = count;
        if (hudLengthCount) hudLengthCount.textContent = `${totalDrawnLengthMeters.toFixed(1)} m`;

        return true;
    }

    function startDrawingMode() {
        if (activeBarrierTool === 'preset') {
            selectBarrierTool('wall');
        }
        isDrawingMode = true;
        isFreehandDrawing = false;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();

        canvas.classList.remove('drawing-freehand-active', 'drawing-sandbag-active');
        if (activeBarrierTool === 'wall') {
            canvas.classList.add('drawing-freehand-active');
            freehandLineMat.color.setHex(0x38bdf8);
            if (rubberBandMat) rubberBandMat.color.setHex(0x38bdf8);
            if (cursorRingMat) cursorRingMat.color.setHex(0x38bdf8);
        } else {
            canvas.classList.add('drawing-sandbag-active');
            freehandLineMat.color.setHex(0xf59e0b);
            if (rubberBandMat) rubberBandMat.color.setHex(0xf59e0b);
            if (cursorRingMat) cursorRingMat.color.setHex(0xf59e0b);
        }
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.add('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Freehand Wall Active...' : 'Freehand Sandbag Active...';
        }
        if (drawActiveActions) drawActiveActions.classList.remove('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.remove('hidden');
        if (drawVertexCount) drawVertexCount.textContent = '0';

        const crestH = barrierHeightInput ? barrierHeightInput.value : (activeBarrierTool === 'wall' ? '2.8' : '1.2');
        const depthD = barrierDepthInput ? barrierDepthInput.value : (activeBarrierTool === 'wall' ? '2.0' : '1.0');

        if (drawingHudBanner) {
            drawingHudBanner.classList.remove('hidden');
            if (hudBannerTitle) hudBannerTitle.textContent = activeBarrierTool === 'wall' ? 'FREEHAND DRAWING: FLOOD WALL' : 'FREEHAND DRAWING: SANDBAG BUND';
            if (hudVertexCount) hudVertexCount.textContent = '0';
            if (hudLengthCount) hudLengthCount.textContent = '0.0 m';
            if (hudCrestVal) hudCrestVal.textContent = `${crestH}m`;
            if (hudDepthVal) hudDepthVal.textContent = `${depthD}m`;
        }
    }

    function stopDrawingMode() {
        isDrawingMode = false;
        isFreehandDrawing = false;
        controls.enabled = true;
        currentDrawingPoints = [];
        currentDrawingWorldPoints = [];
        totalDrawnLengthMeters = 0;
        cleanupDrawingVisuals();

        canvas.classList.remove('drawing-freehand-active', 'drawing-sandbag-active');
        canvas.style.cursor = 'default';
        
        if (btnStartDrawing) {
            btnStartDrawing.classList.remove('active');
            if (btnDrawText) btnDrawText.textContent = activeBarrierTool === 'wall' ? 'Draw Wall on Map' : 'Draw Sandbag on Map';
        }
        if (drawActiveActions) drawActiveActions.classList.add('hidden');
        if (drawLiveInstructions) drawLiveInstructions.classList.add('hidden');
        if (drawingHudBanner) drawingHudBanner.classList.add('hidden');
    }'''

# 3. Update mouse/pointer event listeners
old_listeners = '''    // Live Mouse Move for Interactive Barrier Rubber-Band Preview
    canvas.addEventListener('mousemove', (e) => {
        if (!isDrawingMode) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        
        if (intersects.length > 0) {
            const pt = intersects[0].point;
            cursorRing.visible = true;
            cursorRing.position.set(pt.x, pt.y + 0.25, pt.z);
            
            if (currentDrawingWorldPoints.length > 0) {
                const lastW = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                const posAttr = rubberBandLine.geometry.attributes.position;
                posAttr.setXYZ(0, lastW.x, lastW.y + 0.6, lastW.z);
                posAttr.setXYZ(1, pt.x, pt.y + 0.6, pt.z);
                posAttr.needsUpdate = true;
                rubberBandLine.visible = true;
                
                const segDist = Math.hypot(pt.x - lastW.x, pt.z - lastW.z);
                const currentTotal = totalDrawnLengthMeters + segDist;
                if (hudLengthCount) hudLengthCount.textContent = `${currentTotal.toFixed(1)} m`;
            }
        } else {
            cursorRing.visible = false;
            rubberBandLine.visible = false;
        }
    });

    // Click for Depth Inspection & Interactive Barrier Placement
    canvas.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        
        // If in Drawing Mode
        if (isDrawingMode) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
            const intersects = raycaster.intersectObject(terrainMesh);
            
            if (intersects.length > 0) {
                const pt = intersects[0].point;
                // Minimum distance check to prevent duplicate points on same pixel
                if (currentDrawingWorldPoints.length > 0) {
                    const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                    const dist = Math.hypot(pt.x - lastPt.x, pt.z - lastPt.z);
                    if (dist < 0.8) return;
                    totalDrawnLengthMeters += dist;
                }
                
                const u = (pt.x / meta.width_m) + 0.5;
                const v = -(pt.z / meta.height_m) + 0.5;
                const lon = meta.bbox.west + u * (meta.bbox.east - meta.bbox.west);
                const lat = meta.bbox.south + v * (meta.bbox.north - meta.bbox.south);
                
                currentDrawingPoints.push([lon, lat]);
                currentDrawingWorldPoints.push(new THREE.Vector3(pt.x, pt.y, pt.z));
                
                // Add glowing marker sphere at placed point
                const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;
                const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);
                markerMesh.position.set(pt.x, pt.y + 0.6, pt.z);
                drawingGroup.add(markerMesh);
                drawnVertexMeshes.push(markerMesh);
                
                const count = currentDrawingPoints.length;
                if (drawVertexCount) drawVertexCount.textContent = count;
                if (hudVertexCount) hudVertexCount.textContent = count;
                if (hudLengthCount) hudLengthCount.textContent = `${totalDrawnLengthMeters.toFixed(1)} m`;
                return;
            }
        }'''

new_listeners = '''    // Freehand Drawing Pointer Events & Live Inspection
    canvas.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        
        if (isDrawingMode) {
            const rect = canvas.getBoundingClientRect();
            const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
            const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
            const intersects = raycaster.intersectObject(terrainMesh);
            
            if (intersects.length > 0) {
                isFreehandDrawing = true;
                controls.enabled = false; // Freeze camera rotation while dragging freehand!
                addDrawingPoint(intersects[0].point);
                return;
            }
        }'''

# Also add window pointermove and pointerup
old_pointer_followup = '''    // Double-click finishes the barrier
    canvas.addEventListener('dblclick', (e) => {'''

new_pointer_followup = '''    // Global Pointer Move & Up for Continuous Freehand Dragging
    window.addEventListener('pointermove', (e) => {
        if (!isDrawingMode) return;
        const rect = canvas.getBoundingClientRect();
        const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(new THREE.Vector2(mouseX, mouseY), camera);
        const intersects = raycaster.intersectObject(terrainMesh);
        
        if (intersects.length > 0) {
            const pt = intersects[0].point;
            cursorRing.visible = true;
            cursorRing.position.set(pt.x, pt.y + 0.25, pt.z);
            
            if (isFreehandDrawing) {
                addDrawingPoint(pt);
            } else if (currentDrawingWorldPoints.length > 0) {
                const lastW = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                const posAttr = rubberBandLine.geometry.attributes.position;
                posAttr.setXYZ(0, lastW.x, lastW.y + 0.45, lastW.z);
                posAttr.setXYZ(1, pt.x, pt.y + 0.45, pt.z);
                posAttr.needsUpdate = true;
                rubberBandLine.visible = true;
                
                const segDist = Math.hypot(pt.x - lastW.x, pt.z - lastW.z);
                const currentTotal = totalDrawnLengthMeters + segDist;
                if (hudLengthCount) hudLengthCount.textContent = `${currentTotal.toFixed(1)} m`;
            }
        } else {
            cursorRing.visible = false;
            rubberBandLine.visible = false;
        }
    });

    window.addEventListener('pointerup', (e) => {
        if (isFreehandDrawing) {
            isFreehandDrawing = false;
            controls.enabled = true; // Re-enable camera rotation
            if (currentDrawingWorldPoints.length > 0) {
                const lastPt = currentDrawingWorldPoints[currentDrawingWorldPoints.length - 1];
                const markerMat = activeBarrierTool === 'wall' ? wallVertexMat : sandbagVertexMat;
                const markerMesh = new THREE.Mesh(vertexMarkerGeom, markerMat);
                markerMesh.position.set(lastPt.x, lastPt.y + 0.35, lastPt.z);
                drawingGroup.add(markerMesh);
                drawnVertexMeshes.push(markerMesh);
            }
        }
    });

    // Double-click finishes the barrier
    canvas.addEventListener('dblclick', (e) => {'''

c_norm = c.replace('\r\n', '\n')
if old_setup.replace('\r\n', '\n') in c_norm:
    c_norm = c_norm.replace(old_setup.replace('\r\n', '\n'), new_setup.replace('\r\n', '\n'))
    print('1. Replaced setup')
else:
    print('1. Setup target not found')

if old_drawing_funcs.replace('\r\n', '\n') in c_norm:
    c_norm = c_norm.replace(old_drawing_funcs.replace('\r\n', '\n'), new_drawing_funcs.replace('\r\n', '\n'))
    print('2. Replaced drawing funcs')
else:
    print('2. Drawing funcs target not found')

if old_listeners.replace('\r\n', '\n') in c_norm:
    c_norm = c_norm.replace(old_listeners.replace('\r\n', '\n'), new_listeners.replace('\r\n', '\n'))
    print('3. Replaced listeners')
else:
    print('3. Listeners target not found')

if old_pointer_followup.replace('\r\n', '\n') in c_norm:
    c_norm = c_norm.replace(old_pointer_followup.replace('\r\n', '\n'), new_pointer_followup.replace('\r\n', '\n'))
    print('4. Replaced pointer followup')
else:
    print('4. Pointer followup target not found')

with open('src/main.js', 'w', encoding='utf-8', newline='\r\n') as f:
    f.write(c_norm.replace('\n', '\r\n'))

print('Freehand drawing integrated into src/main.js successfully!')
