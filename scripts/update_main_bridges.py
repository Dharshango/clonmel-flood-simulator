with open('src/main.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add import
imp_target = "import { createRoadsLayer } from './rendering/roads.js';"
imp_replace = "import { createRoadsLayer } from './rendering/roads.js';\nimport { createBridgesLayer } from './rendering/bridges.js';"
if imp_target in text:
    text = text.replace(imp_target, imp_replace, 1)

# 2. Add bridgesLayer to scene
add_target = "scene.add(roadsLayer.group);"
add_replace = """scene.add(roadsLayer.group);
    
    // 3D Bridges Layer (Authentic Old Bridge, Gashouse Bridge, Workhouse Bridge)
    const bridgesLayer = createBridgesLayer(meta, elevArray, roadsResp);
    scene.add(bridgesLayer.group);"""
if add_target in text:
    text = text.replace(add_target, add_replace, 1)

# 3. Update Old Bridge camera preset
cam_target = """        { 
            id: 'old-bridge',
            name: 'Old Bridge', 
            fullName: 'Old Bridge & Weir Rapids',
            sub: 'Historic Arches & Western Inlet',
            pos: new THREE.Vector3(-410, 180, 560), 
            target: new THREE.Vector3(-170, 22, 323) 
        },"""
cam_replace = """        { 
            id: 'old-bridge',
            name: 'Old Bridge', 
            fullName: 'Old Bridge (Droichead Ársa)',
            sub: 'Historic Multi-Arch Bridge & Suir Island',
            pos: new THREE.Vector3(-140, 140, 540), 
            target: new THREE.Vector3(55, 23, 340) 
        },"""
if cam_target in text:
    text = text.replace(cam_target, cam_replace, 1)

# 4. Update label position
lbl_target = "{ el: document.getElementById('label-old-bridge'), lon: -7.7075, lat: 52.3516, yOffset: 25 },"
lbl_replace = "{ el: document.getElementById('label-old-bridge'), lon: -7.7041, lat: 52.3514, yOffset: 25 },"
if lbl_target in text:
    text = text.replace(lbl_target, lbl_replace, 1)

with open('src/main.js', 'w', encoding='utf-8') as f:
    f.write(text)
print('Successfully integrated bridgesLayer and updated Old Bridge preset in main.js!')
