/**
 * hydroverse_hero.js
 * 
 * Interactive Hydroverse Hero Background Engine
 * Integrates:
 * - Real-time procedural terrain contour lines (marching squares)
 * - Hydrodynamic river streamlines and current drift
 * - Luminous micro tracer particles with wake trails
 * - Interactive mouse water displacement & propagating glowing wave ripples
 * - Dynamic water level tracking cursor vertical position
 * - Live sensor telemetry readout (+X.XXm, XX% inundation, Lat/Lon coordinates)
 * - Auto-sleep on hero dismissal (.hidden) to free 100% GPU/CPU for 3D simulator
 */

export function initHydroverseHero() {
    const canvas = document.getElementById('terrain');
    if (!canvas) return null;
    const ctx = canvas.getContext('2d', { alpha: true });
    const hero = document.querySelector('.hero');
    if (!hero) return null;

    const levelText = document.getElementById('water-level');
    const extentText = document.getElementById('flood-extent');
    const extentMeter = document.getElementById('extent-meter');
    const coordinates = document.getElementById('coordinates');
    const dialog = document.getElementById('info-dialog');
    const howLink = document.getElementById('how-link');
    const closeDialog = document.getElementById('close-dialog');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    let width = 0;
    let height = 0;
    let dpr = 1;
    let step = 22;
    let cols = 0;
    let rows = 0;
    let values = [];
    let waterLevel = 0.43;
    let pointerTarget = 0.43;
    let pointer = { x: 0, y: 0, active: false, lastRipple: 0 };
    let ripples = [];
    let lastFrame = 0;
    let lastReadout = 0;
    let raf = 0;
    let isRunning = false;
    const baseLevel = 0.43;

    // Contour Levels & Colors
    const contourLevels = [0.21, 0.28, 0.35, 0.50, 0.57, 0.64, 0.71, 0.78, 0.85];
    const contourColors = [
        'rgba(121, 194, 190, 0.28)',
        'rgba(131, 202, 195, 0.32)',
        'rgba(143, 212, 201, 0.35)',
        'rgba(142, 198, 194, 0.32)',
        'rgba(139, 192, 193, 0.28)',
        'rgba(134, 184, 188, 0.25)',
        'rgba(128, 176, 184, 0.22)',
        'rgba(119, 165, 177, 0.20)',
        'rgba(113, 155, 169, 0.18)'
    ];

    // Hydrodynamic Streamline Layers
    const waveLayers = [
        { yRel: 0.24, amp: 18, freq: 0.0022, speed: 0.0011, phase: 0.0, color: 'rgba(56, 189, 248, 0.18)', width: 1.5 },
        { yRel: 0.38, amp: 26, freq: 0.0018, speed: 0.0014, phase: 1.5, color: 'rgba(14, 165, 233, 0.24)', width: 1.8 },
        { yRel: 0.50, amp: 30, freq: 0.0015, speed: 0.0016, phase: 2.9, color: 'rgba(45, 212, 191, 0.28)', width: 2.0 },
        { yRel: 0.64, amp: 24, freq: 0.0017, speed: 0.0013, phase: 4.2, color: 'rgba(125, 226, 210, 0.22)', width: 1.8 },
        { yRel: 0.78, amp: 20, freq: 0.0020, speed: 0.0010, phase: 5.4, color: 'rgba(20, 184, 166, 0.16)', width: 1.4 }
    ];

    // Drifting Tracer Particles
    const particleCount = 45;
    const particles = [];

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * (width || 1440),
                y: Math.random() * (height || 900),
                vx: 0.6 + Math.random() * 1.4,
                baseYRel: 0.20 + Math.random() * 0.65,
                size: 1.0 + Math.random() * 2.2,
                alpha: 0.25 + Math.random() * 0.55,
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
    const mix = (a, b, t) => a + (b - a) * t;
    const mod = (n, m) => ((n % m) + m) % m;

    function terrainValue(x, y) {
        const channel = 0.36 + 0.28 * x + 0.12 * Math.sin(x * 5.1 + 0.4) + 0.045 * Math.sin(x * 13.2 - 0.7);
        const distance = y - channel;
        const valley = 0.4 * (1 - Math.exp(-(distance * distance) / 0.016));
        const ridges = 0.55 * (0.075 * Math.sin(x * 9.4 + y * 5.5) + 0.058 * Math.sin(y * 11.7 - x * 3.6) + 0.032 * Math.cos(x * 20 + y * 13));
        const broad = 0.55 * 0.055 * Math.sin(x * 2.8 - y * 3.4);
        return clamp(0.30 + valley * 0.82 + ridges + broad, 0.04, 0.99);
    }

    function resize() {
        const rect = hero.getBoundingClientRect();
        width = rect.width || window.innerWidth;
        height = rect.height || window.innerHeight;
        if (width === 0 || height === 0) return;
        dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        canvas.width = Math.round(width * dpr);
        canvas.height = Math.round(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        step = width < 640 ? 19 : 23;
        cols = Math.ceil(width / step) + 1;
        rows = Math.ceil(height / step) + 1;
        values = new Float32Array(cols * rows);
        for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
                values[y * cols + x] = terrainValue((x * step) / width, (y * step) / height);
            }
        }
        initParticles();
    }

    function drawContours(level, color, lineWidth) {
        ctx.beginPath();
        const edge = (ax, ay, av, bx, by, bv) => {
            const crosses = (av < level) !== (bv < level);
            if (!crosses) return null;
            const t = (level - av) / (bv - av);
            return [mix(ax, bx, t), mix(ay, by, t)];
        };

        for (let gy = 0; gy < rows - 1; gy++) {
            for (let gx = 0; gx < cols - 1; gx++) {
                const x = gx * step;
                const y = gy * step;
                const tl = values[gy * cols + gx];
                const tr = values[gy * cols + gx + 1];
                const br = values[(gy + 1) * cols + gx + 1];
                const bl = values[(gy + 1) * cols + gx];
                const points = [
                    edge(x, y, tl, x + step, y, tr),
                    edge(x + step, y, tr, x + step, y + step, br),
                    edge(x + step, y + step, br, x, y + step, bl),
                    edge(x, y + step, bl, x, y, tl),
                ];
                const hits = points.map((point, i) => point ? [i, point] : null).filter(Boolean);
                if (hits.length === 2) {
                    ctx.moveTo(hits[0][1][0], hits[0][1][1]);
                    ctx.lineTo(hits[1][1][0], hits[1][1][1]);
                } else if (hits.length === 4) {
                    const centerLow = (tl + tr + br + bl) * 0.25 < level;
                    const pairs = centerLow ? [[0, 3], [1, 2]] : [[0, 1], [2, 3]];
                    for (const [a, b] of pairs) {
                        ctx.moveTo(points[a][0], points[a][1]);
                        ctx.lineTo(points[b][0], points[b][1]);
                    }
                }
            }
        }
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    function drawFlood(level) {
        const cell = step * 0.83;
        for (let gy = 0; gy < rows - 1; gy++) {
            for (let gx = 0; gx < cols - 1; gx++) {
                const v = (values[gy * cols + gx] + values[gy * cols + gx + 1] + values[(gy + 1) * cols + gx] + values[(gy + 1) * cols + gx + 1]) * 0.25;
                if (v < level) {
                    const intensity = clamp((level - v) / 0.22, 0, 1);
                    ctx.fillStyle = `rgba(31, 192, 177, ${0.08 + intensity * 0.24})`;
                    ctx.fillRect(gx * step + 1, gy * step + 1, cell, cell);
                }
            }
        }
    }

    function drawStreamlines(time) {
        ctx.save();
        for (const layer of waveLayers) {
            ctx.beginPath();
            const baseY = layer.yRel * height;
            for (let x = 0; x <= width; x += 16) {
                const wave1 = Math.sin(x * layer.freq + time * layer.speed + layer.phase) * layer.amp;
                const wave2 = Math.cos(x * layer.freq * 0.6 - time * layer.speed * 0.8) * (layer.amp * 0.35);
                const y = baseY + wave1 + wave2;
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = layer.color;
            ctx.lineWidth = layer.width;
            ctx.shadowColor = 'rgba(125, 226, 210, 0.45)';
            ctx.shadowBlur = 4;
            ctx.stroke();
        }
        ctx.restore();
    }

    function drawTracerParticles(time) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (const p of particles) {
            p.x += p.vx;
            if (p.x > width + 20) {
                p.x = -20;
                p.y = (p.baseYRel + (Math.random() - 0.5) * 0.2) * height;
            }
            const pulse = 0.5 + 0.5 * Math.sin(time * 0.002 + p.pulse);
            const alpha = p.alpha * pulse;
            ctx.beginPath();
            ctx.arc(p.x, p.y + Math.sin(p.x * 0.004 + time * 0.001) * 8, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(160, 240, 223, ${alpha})`;
            ctx.shadowColor = 'rgba(125, 226, 210, 0.8)';
            ctx.shadowBlur = 6;
            ctx.fill();
        }
        ctx.restore();
    }

    function drawFlow(time) {
        const count = width < 640 ? 12 : 20;
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        for (let i = 0; i < count; i++) {
            const x = mod(i / count + time * 0.009, 1);
            const channel = 0.36 + 0.28 * x + 0.12 * Math.sin(x * 5.1 + 0.4) + 0.045 * Math.sin(x * 13.2 - 0.7);
            const y = channel + Math.sin(time * 0.00045 + i * 2.7) * 0.009;
            const px = x * width;
            const py = y * height;
            const pulse = 0.50 + 0.40 * Math.sin(time * 0.0014 + i);
            ctx.beginPath();
            ctx.ellipse(px, py, 3.8, 1.6, -0.15, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(158, 245, 226, ${pulse})`;
            ctx.shadowColor = 'rgba(108, 238, 216, 0.85)';
            ctx.shadowBlur = 10;
            ctx.fill();
        }
        ctx.restore();
    }

    function drawRipples(time) {
        ripples = ripples.filter(r => time - r.start < (reduceMotion.matches ? 700 : 1900));
        ctx.save();
        for (const ripple of ripples) {
            const duration = reduceMotion.matches ? 700 : 1900;
            const age = (time - ripple.start) / duration;
            const radius = 8 + age * 130;
            const alpha = (1 - age) * 0.55 * ripple.strength;
            
            ctx.beginPath();
            ctx.arc(ripple.x, ripple.y, radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(125, 226, 210, ${alpha})`;
            ctx.lineWidth = 1.6 * (1 - age * 0.5);
            ctx.shadowColor = 'rgba(125, 226, 210, 0.75)';
            ctx.shadowBlur = 8;
            ctx.stroke();

            if (age < 0.75) {
                ctx.beginPath();
                ctx.arc(ripple.x, ripple.y, radius * 0.62, 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(160, 240, 223, ${alpha * 0.65})`;
                ctx.lineWidth = 1.0;
                ctx.stroke();
            }
        }
        ctx.restore();
    }

    function updateReadout(time) {
        if (time - lastReadout < 120) return;
        lastReadout = time;
        const meters = Math.max(0, (waterLevel - 0.31) * 6.1);
        let flooded = 0;
        for (let i = 0; i < values.length; i++) {
            if (values[i] < waterLevel) flooded++;
        }
        const percent = Math.round(flooded / values.length * 100);
        if (levelText) levelText.textContent = `+${meters.toFixed(2)}`;
        if (extentText) extentText.textContent = `${percent}%`;
        if (extentMeter) extentMeter.style.width = `${percent}%`;
        if (!pointer.active && coordinates) {
            coordinates.textContent = '52°21′ N   7°42′ W';
        }
    }

    function frame(time) {
        if (!isRunning) return;
        raf = 0;
        if (time - lastFrame < (reduceMotion.matches ? 80 : 33)) {
            raf = requestAnimationFrame(frame);
            return;
        }
        const dt = Math.min((time - (lastFrame || time)) / 1000, 0.06);
        lastFrame = time;

        const target = pointer.active ? pointerTarget : baseLevel;
        waterLevel += (target - waterLevel) * (1 - Math.exp(-dt * 1.6));

        ctx.clearRect(0, 0, width, height);

        // 1. Shaded Flood Inundation Plane
        drawFlood(waterLevel);

        // 2. Marching Squares Topographic Contours
        contourLevels.forEach((level, i) => drawContours(level, contourColors[i], 0.75));
        drawContours(waterLevel, 'rgba(125, 226, 210, 0.85)', 1.4);

        // 3. Hydrodynamic Streamline Waves
        drawStreamlines(time);

        // 4. Flow pulses along river channel
        drawFlow(time);

        // 5. Drifting Tracer Particles
        drawTracerParticles(time);

        // 6. Interactive Mouse Ripples
        drawRipples(time);

        // 7. Live Telemetry Readout
        updateReadout(time);

        raf = requestAnimationFrame(frame);
    }

    function addRipple(x, y, strength = 1) {
        if (ripples.length > 16) ripples.shift();
        ripples.push({ x, y, start: performance.now(), strength });
    }

    hero.addEventListener('pointermove', (event) => {
        if (event.target.closest('button, a, dialog')) return;
        const rect = hero.getBoundingClientRect();
        pointer.x = event.clientX - rect.left;
        pointer.y = event.clientY - rect.top;
        pointer.active = true;
        pointerTarget = 0.32 + (1 - clamp(pointer.y / height, 0, 1)) * 0.28;
        const now = performance.now();
        if (now - pointer.lastRipple > (event.pointerType === 'touch' ? 200 : 140)) {
            addRipple(pointer.x, pointer.y, event.pointerType === 'touch' ? 0.9 : 1.1);
            pointer.lastRipple = now;
        }
        if (coordinates) {
            coordinates.textContent = `${(52.35 + (pointer.y / height - 0.5) * 0.04).toFixed(3)}° N   ${(7.71 + (pointer.x / width - 0.5) * 0.08).toFixed(3)}° W`;
        }
    }, { passive: true });

    hero.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button, a, dialog')) return;
        const rect = hero.getBoundingClientRect();
        addRipple(event.clientX - rect.left, event.clientY - rect.top, 1.5);
    }, { passive: true });

    hero.addEventListener('pointerleave', (event) => {
        if (event.pointerType !== 'touch') pointer.active = false;
    });

    if (howLink && dialog) {
        howLink.addEventListener('click', (event) => {
            event.preventDefault();
            if (typeof dialog.showModal === 'function') {
                try {
                    dialog.showModal();
                } catch (e) {
                    dialog.setAttribute('open', '');
                }
            } else {
                dialog.setAttribute('open', '');
            }
        });
    }

    if (closeDialog && dialog) {
        closeDialog.addEventListener('click', () => {
            if (typeof dialog.close === 'function') {
                try { dialog.close(); } catch(e) {}
            }
            dialog.removeAttribute('open');
        });
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) {
                if (typeof dialog.close === 'function') {
                    try { dialog.close(); } catch(e) {}
                }
                dialog.removeAttribute('open');
            }
        });
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        resize();
        raf = requestAnimationFrame(frame);
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    }

    // Auto-pause animation when hero is dismissed (.hidden) to free 100% GPU/CPU for 3D solver
    const observer = new MutationObserver(() => {
        if (hero.classList.contains('hidden') || hero.style.display === 'none') {
            stop();
        } else {
            start();
        }
    });
    observer.observe(hero, { attributes: true, attributeFilter: ['class', 'style'] });

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(hero);

    if (!hero.classList.contains('hidden') && hero.style.display !== 'none') {
        start();
    }

    return { start, stop, resize, addRipple };
}
