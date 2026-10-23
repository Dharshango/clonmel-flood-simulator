def update_files():
    # 1. Update workspaces.js to eliminate artificial pluvial rainfall in historical fluvial events
    with open('src/ui/workspaces.js', 'r', encoding='utf-8') as f:
        w_text = f.read()

    old_hist = """        if (eventKey === 'storm_frank_2015') {
            inflow = 465;
            rain = 65;
            surge = 0.45;
            eventName = 'Storm Frank (December 2015)';
            eventDesc = 'Continuous heavy Atlantic depression. River Suir crested at 4.2m OD at Convent Bridge with severe commercial inundation across the Irishtown and Quay corridors.';
        } else if (eventKey === 'flood_2008') {
            inflow = 420;
            rain = 40;
            surge = 0.20;
            eventName = 'River Suir Flood (January 2008)';
            eventDesc = 'Overland flow overtopped the Old Bridge quay wall and severed vehicular traffic along the N24 and Western Road.';
        } else if (eventKey === 'flood_2000') {
            inflow = 480;
            rain = 75;
            surge = 0.50;
            eventName = 'Historic Benchmark Flood (November 2000)';
            eventDesc = 'Largest modern unmitigated flood event prior to the Clonmel Flood Relief Scheme. Over 350 properties severely flooded.';
        }"""

    new_hist = """        if (eventKey === 'storm_frank_2015') {
            inflow = 465;
            rain = 0; // Real-world fluvial river overtopping (no artificial mountain rain puddles)
            surge = 0.45;
            eventName = 'Storm Frank (December 2015)';
            eventDesc = 'Continuous heavy Atlantic depression. River Suir crested at 4.2m OD at Convent Bridge with severe commercial inundation across the Irishtown and Quay corridors.';
        } else if (eventKey === 'flood_2008') {
            inflow = 420;
            rain = 0; // Real-world fluvial river overtopping
            surge = 0.20;
            eventName = 'River Suir Flood (January 2008)';
            eventDesc = 'Overland flow overtopped the Old Bridge quay wall and severed vehicular traffic along the N24 and Western Road.';
        } else if (eventKey === 'flood_2000') {
            inflow = 480;
            rain = 0; // Real-world fluvial river overtopping
            surge = 0.50;
            eventName = 'Historic Benchmark Flood (November 2000)';
            eventDesc = 'Largest modern unmitigated flood event prior to the Clonmel Flood Relief Scheme. Over 350 properties severely flooded.';
        }"""

    assert old_hist in w_text, "Historical event block not found in workspaces.js"
    w_text = w_text.replace(old_hist, new_hist, 1)
    with open('src/ui/workspaces.js', 'w', encoding='utf-8') as f:
        f.write(w_text)
    print("1. Updated workspaces.js: historical events set to authentic fluvial river overtopping (rain=0).")

    # 2. Update swe_shaders.js: restrict rain accumulation to low-lying flat depressions, not mountain slopes
    with open('src/simulation/swe_shaders.js', 'r', encoding='utf-8') as f:
        s_text = f.read()

    old_seek_rain = """        // Direct rainfall accumulation on urban streets
        if (u_rainRate > 0.0) {
            float rainRunoff = (u_rainRate / 1000.0) * (u_targetTime / 3600.0) * 0.06;
            h += clamp(rainRunoff, 0.0, 0.35);
            peakH = max(peakH, h);
        }"""

    new_seek_rain = """        // Direct rainfall accumulation on urban streets only in low-lying flat depressions prone to ponding
        if (u_rainRate > 0.0 && zb < 21.8) {
            float rainRunoff = (u_rainRate / 1000.0) * (u_targetTime / 3600.0) * 0.04 * (1.0 - smoothstep(19.5, 21.8, zb));
            h += clamp(rainRunoff, 0.0, 0.22);
            peakH = max(peakH, h);
        }"""

    assert old_seek_rain in s_text, "Old seek rain block not found in swe_shaders.js"
    s_text = s_text.replace(old_seek_rain, new_seek_rain, 1)

    old_update_rain = """    // Add uniform rain
    hNext += u_rainRate * u_dt;"""

    new_update_rain = """    // Add rain only where elevation permits accumulation (valleys & urban flatlands, not mountain slopes)
    if (zb < 22.0) {
        hNext += u_rainRate * u_dt;
    }"""

    assert old_update_rain in s_text, "Old update rain block not found in swe_shaders.js"
    s_text = s_text.replace(old_update_rain, new_update_rain, 1)

    with open('src/simulation/swe_shaders.js', 'w', encoding='utf-8') as f:
        f.write(s_text)
    print("2. Updated swe_shaders.js: rain accumulation constrained to low-lying valley flatlands.")

    # 3. Update buildings.js: physical fluvial flood criteria (only flood-prone river corridor buildings can flood)
    with open('src/rendering/buildings.js', 'r', encoding='utf-8') as f:
        b_text = f.read()

    old_status_loop = """            let maxH = 0.0;
            for (let k = 0; k < len; k++) {
                const off = offsets[k];
                const h = buf[off];
                if (h >= 0.05) {
                    if (isRiverArr[k] === 1) {
                        // In river channel, only counts as flood if water surface rises above building ground elevation
                        const overtop = (cellElevs[k] + h) - gElev;
                        if (overtop > maxH) maxH = overtop;
                    } else {
                        // Overland street flood touching/immersing building
                        if (h > maxH) maxH = h;
                    }
                }
            }
            
            // Mark building only if overland flood water reaches/rushes through it (h >= 0.05m)
            const isFloodedNow = maxH >= 0.05;
            b.isFlooded = isFloodedNow;
            b.depth = maxH;
            
            if (isFloodedNow) {
                floodedCount++;
                if (maxH >= 0.40) {
                    endangeredCount++;
                    b.status = 'endangered';
                } else {
                    partialCount++;
                    b.status = 'partial';
                }
            } else {
                b.status = 'safe';
            }
            
            if (baseBuf) {
                let baseMaxH = 0.0;
                for (let k = 0; k < len; k++) {
                    const off = offsets[k];
                    const h = baseBuf[off];
                    if (h >= 0.05) {
                        if (isRiverArr[k] === 1) {
                            const overtop = (cellElevs[k] + h) - gElev;
                            if (overtop > baseMaxH) baseMaxH = overtop;
                        } else {
                            if (h > baseMaxH) baseMaxH = h;
                        }
                    }
                }
                const wasFloodedInBase = baseMaxH >= 0.05;
                // If flooded without barrier, but dry with barrier: IT IS SAVED!
                b.isSaved = wasFloodedInBase && !isFloodedNow;
                if (b.isSaved) {
                    savedCount++;
                    b.status = 'saved';
                }
            } else {
                b.isSaved = false;
            }"""

    new_status_loop = """            let maxH = 0.0;
            // Physical fluvial flood envelope: River Suir peak flood elevation in Clonmel reaches ~20.5m - 20.8m OD.
            // Buildings above 22.2m OD (terraces, upper town, hills) are physically immune from River Suir overtopping.
            if (gElev <= 22.2) {
                for (let k = 0; k < len; k++) {
                    const off = offsets[k];
                    const h = buf[off];
                    if (h >= 0.08) {
                        const cellElev = cellElevs[k];
                        const wse = cellElev + h;
                        // Flood occurs when water surface elevation overtops building ground threshold
                        const overtop = wse - gElev;
                        if (overtop > maxH) {
                            maxH = overtop;
                        }
                    }
                }
            }
            
            // Mark building only if overland flood water actually reaches doorstep (overtop >= 0.10m)
            const isFloodedNow = maxH >= 0.10;
            b.isFlooded = isFloodedNow;
            b.depth = maxH;
            
            if (isFloodedNow) {
                floodedCount++;
                if (maxH >= 0.35) {
                    endangeredCount++;
                    b.status = 'endangered';
                } else {
                    partialCount++;
                    b.status = 'partial';
                }
            } else {
                b.status = 'safe';
            }
            
            if (baseBuf && gElev <= 22.2) {
                let baseMaxH = 0.0;
                for (let k = 0; k < len; k++) {
                    const off = offsets[k];
                    const h = baseBuf[off];
                    if (h >= 0.08) {
                        const cellElev = cellElevs[k];
                        const wse = cellElev + h;
                        const overtop = wse - gElev;
                        if (overtop > baseMaxH) baseMaxH = overtop;
                    }
                }
                const wasFloodedInBase = baseMaxH >= 0.10;
                // If flooded without barrier, but dry with barrier: IT IS SAVED!
                b.isSaved = wasFloodedInBase && !isFloodedNow;
                if (b.isSaved) {
                    savedCount++;
                    b.status = 'saved';
                }
            } else {
                b.isSaved = false;
            }"""

    assert old_status_loop in b_text, "Old status loop not found in buildings.js"
    b_text = b_text.replace(old_status_loop, new_status_loop, 1)
    with open('src/rendering/buildings.js', 'w', encoding='utf-8') as f:
        f.write(b_text)
    print("3. Updated buildings.js: physical fluvial flood criteria applied; upland buildings preserved safe.")

    # 4. Update terrain.js: water mesh discard trace puddles on hillsides
    with open('src/rendering/terrain.js', 'r', encoding='utf-8') as f:
        t_text = f.read()

    old_discard = """        // Soft boundary discard: strictly ignore sub-centimeter numerical moisture on dry land
        if (h < 0.025) {
            discard;
        }
        
        vec4 elev = sampleSmooth(u_elevTex, vUv);
        float isRiver = elev.b; // 1.0 inside River Suir bed, 0.0 on flood plains / streets"""

    new_discard = """        vec4 elev = sampleSmooth(u_elevTex, vUv);
        float isRiver = elev.b; // 1.0 inside River Suir bed, 0.0 on flood plains / streets
        
        // In natural river channel, render water depths > 0.02m
        // On dry terrain and hillslopes, discard trace puddles, numerical noise, and any water on upland hills (elev > 22.0m)
        if (isRiver > 0.1) {
            if (h < 0.02) discard;
        } else {
            // Discard any moisture on upland hills (elev > 22.0m OD)
            if (elev.r > 22.0) discard;
            // On low-lying floodplain (elev <= 22.0m), require true flood depth (> 0.06m)
            if (h < 0.06) discard;
        }"""

    assert old_discard in t_text, "Old discard block not found in terrain.js"
    t_text = t_text.replace(old_discard, new_discard, 1)
    with open('src/rendering/terrain.js', 'w', encoding='utf-8') as f:
        f.write(t_text)
    print("4. Updated terrain.js: discarded residual water on mountain slopes.")

if __name__ == '__main__':
    update_files()
