/**
 * hero_background.js - Interactive Hydrodynamic Water Background for Hero Section
 * 
 * Features:
 * - Fluid hydrodynamic streamlines simulating River Suir current flow
 * - Interactive mouse water displacement & propagating circular wave ripples
 * - Micro tracer particles drifting along flow streamlines with wake trails
 * - Deep oceanic sapphire-azure gradient caustics with ambient depth lighting
 * - Auto-sleep on hero dismissal (.hidden) for zero CPU/GPU overhead during 3D simulation
 */

export function initHeroBackground() {
    const heroSection = document.getElementById('hero-section');
    const canvas = document.getElementById('hero-water-canvas');
    if (!heroSection || !canvas) return null;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animId = null;
    let isRunning = false;

    // Mouse & Touch State
    const mouse = {
        x: -1000,
        y: -1000,
        targetX: -1000,
        targetY: -1000,
        vx: 0,
        vy: 0,
        lastX: -1000,
        lastY: -1000,
        isOver: false,
        lastMoveTime: 0
    };

    // Wave ripples array
    const ripples = [];
    const maxRipples = 12;

    function addRipple(x, y, strength = 1.0, maxRad = 360) {
        if (ripples.length >= maxRipples) {
            ripples.shift();
        }
        ripples.push({
            x,
            y,
            radius: 0,
            maxRadius: maxRad,
            speed: 3.8 + Math.random() * 1.2,
            strength: strength,
            life: 1.0
        });
    }

    // River Streamline Definitions
    // 6 streamlines staggered vertically across the viewport
    const waveLayers = [
        { yRel: 0.22, amp: 26, freq: 0.0018, speed: 0.0009, phase: 0.0, color: 'rgba(56, 189, 248, 0.16)', width: 1.5, fill: true },
        { yRel: 0.35, amp: 32, freq: 0.0015, speed: 0.0011, phase: 1.4, color: 'rgba(14, 165, 233, 0.22)', width: 1.8, fill: true },
        { yRel: 0.48, amp: 38, freq: 0.0012, speed: 0.0014, phase: 2.8, color: 'rgba(2, 132, 199, 0.28)', width: 2.0, fill: true },
        { yRel: 0.62, amp: 42, freq: 0.0014, speed: 0.0012, phase: 4.1, color: 'rgba(3, 105, 161, 0.24)', width: 1.8, fill: true },
        { yRel: 0.75, amp: 34, freq: 0.0016, speed: 0.0010, phase: 5.3, color: 'rgba(30, 64, 175, 0.20)', width: 1.5, fill: true },
        { yRel: 0.88, amp: 28, freq: 0.0020, speed: 0.0008, phase: 0.8, color: 'rgba(30, 58, 138, 0.15)', width: 1.2, fill: false }
    ];

    // Tracer Particles (flowing eastward like River Suir water molecules)
    const particleCount = 65;
    const particles = [];

    function initParticles() {
        particles.length = 0;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * width,
                y: Math.random() * height,
                baseYRel: 0.15 + Math.random() * 0.75,
                vx: 0.8 + Math.random() * 1.5,
                size: 1.2 + Math.random() * 2.0,
                alpha: 0.2 + Math.random() * 0.5,
                trail: []
            });
        }
    }

    // Resize canvas
    function resize() {
        const rect = heroSection.getBoundingClientRect();
        width = rect.width || window.innerWidth;
        height = rect.height || window.innerHeight;
        dpr = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.scale(dpr, dpr);

        if (particles.length === 0) {
            initParticles();
        }
    }

    // Handle mouse movements
    function onMouseMove(e) {
        const rect = canvas.getBoundingClientRect();
        const curX = e.clientX - rect.left;
        const curY = e.clientY - rect.top;

        if (!mouse.isOver) {
            mouse.x = curX;
            mouse.y = curY;
            mouse.targetX = curX;
            mouse.targetY = curY;
            mouse.lastX = curX;
            mouse.lastY = curY;
            mouse.isOver = true;
        } else {
            mouse.targetX = curX;
            mouse.targetY = curY;
        }

        const dx = curX - mouse.lastX;
        const dy = curY - mouse.lastY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Spawn smooth micro-ripples as user glides through water
        const now = performance.now();
        if (dist > 32 && now - mouse.lastMoveTime > 110) {
            addRipple(curX, curY, Math.min(dist / 40, 1.2), 220);
            mouse.lastX = curX;
            mouse.lastY = curY;
            mouse.lastMoveTime = now;
        }
    }

    function onMouseLeave() {
        mouse.isOver = false;
        mouse.targetX = -1000;
        mouse.targetY = -1000;
    }

    function onClick(e) {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        // Expanding hydrodynamic splash pulse
        addRipple(clickX, clickY, 2.2, 480);
    }

    // Attach interaction listeners to heroSection so interactions on top of content still trigger ripples
    heroSection.addEventListener('mousemove', onMouseMove, { passive: true });
    heroSection.addEventListener('mouseleave', onMouseLeave, { passive: true });
    heroSection.addEventListener('click', onClick, { passive: true });
    window.addEventListener('resize', resize, { passive: true });

    // Idle droplet timer (adds gentle natural ambiance when user is not moving mouse)
    let lastDropletTime = 0;

    // Main Animation Loop
    let time = 0;

    function render(timestamp) {
        if (!isRunning) return;

        time = timestamp;

        // Smooth mouse spring interpolation
        if (mouse.isOver) {
            const dx = mouse.targetX - mouse.x;
            const dy = mouse.targetY - mouse.y;
            mouse.vx = mouse.vx * 0.75 + dx * 0.12;
            mouse.vy = mouse.vy * 0.75 + dy * 0.12;
            mouse.x += mouse.vx;
            mouse.y += mouse.vy;
        } else {
            mouse.x = -1000;
            mouse.y = -1000;
        }

        // Ambient idle droplets
        if (timestamp - lastDropletTime > 2800 && (!mouse.isOver || timestamp - mouse.lastMoveTime > 3000)) {
            const dropX = width * (0.15 + Math.random() * 0.70);
            const dropY = height * (0.20 + Math.random() * 0.65);
            addRipple(dropX, dropY, 0.7 + Math.random() * 0.5, 200 + Math.random() * 80);
            lastDropletTime = timestamp;
        }

        // Update Ripples
        for (let i = ripples.length - 1; i >= 0; i--) {
            const r = ripples[i];
            r.radius += r.speed;
            r.life = Math.max(0, 1 - (r.radius / r.maxRadius));
            if (r.life <= 0) {
                ripples.splice(i, 1);
            }
        }

        // 1. Clear with deep oceanic river gradient
        ctx.clearRect(0, 0, width, height);

        // Rich deep midnight blue background
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#060a14');
        bgGrad.addColorStop(0.5, '#070f20');
        bgGrad.addColorStop(1, '#050811');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Ambient fluid pools (Suir river channel caustics)
        const radWest = ctx.createRadialGradient(width * 0.25, height * 0.45, 0, width * 0.25, height * 0.45, width * 0.5);
        radWest.addColorStop(0, 'rgba(4, 56, 210, 0.14)');
        radWest.addColorStop(0.6, 'rgba(2, 132, 199, 0.05)');
        radWest.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radWest;
        ctx.fillRect(0, 0, width, height);

        const radEast = ctx.createRadialGradient(width * 0.75, height * 0.55, 0, width * 0.75, height * 0.55, width * 0.45);
        radEast.addColorStop(0, 'rgba(6, 182, 212, 0.09)');
        radEast.addColorStop(0.7, 'rgba(4, 56, 210, 0.03)');
        radEast.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = radEast;
        ctx.fillRect(0, 0, width, height);

        // Dynamic mouse water illumination
        if (mouse.x > -500) {
            const mouseGlow = ctx.createRadialGradient(mouse.x, mouse.y, 0, mouse.x, mouse.y, 360);
            mouseGlow.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
            mouseGlow.addColorStop(0.4, 'rgba(2, 132, 199, 0.08)');
            mouseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = mouseGlow;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Draw Interactive Hydrodynamic Streamlines
        const stepX = 14;
        const totalSteps = Math.ceil(width / stepX) + 1;

        waveLayers.forEach((layer) => {
            const baseY = height * layer.yRel;
            const points = [];

            for (let step = 0; step <= totalSteps; step++) {
                const x = step * stepX;
                
                // Base sine wave motion
                let y = baseY + 
                    Math.sin(x * layer.freq + time * layer.speed + layer.phase) * layer.amp +
                    Math.cos(x * layer.freq * 1.8 - time * layer.speed * 0.7) * (layer.amp * 0.35);

                // Fluid mouse proximity lift / deflection
                if (mouse.x > -500) {
                    const dx = x - mouse.x;
                    const dy = y - mouse.y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 240) {
                        const factor = Math.cos((d / 240) * (Math.PI / 2));
                        // Buoyancy push
                        y += (dy > 0 ? 1 : -1) * factor * 22;
                    }
                }

                // Wave ripple displacement
                for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
                    const r = ripples[rIdx];
                    const rx = x - r.x;
                    const ry = baseY - r.y;
                    const dist = Math.sqrt(rx * rx + ry * ry);
                    const diff = Math.abs(dist - r.radius);
                    if (diff < 55) {
                        const waveFactor = Math.cos((diff / 55) * Math.PI) * r.life * r.strength;
                        y += Math.sin((dist - r.radius) * 0.12) * waveFactor * 16;
                    }
                }

                points.push({ x, y });
            }

            // Draw Streamline Path with Smooth Splines
            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length - 1; i++) {
                const xc = (points[i].x + points[i + 1].x) / 2;
                const yc = (points[i].y + points[i + 1].y) / 2;
                ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
            }

            const lastPt = points[points.length - 1];
            ctx.lineTo(lastPt.x, lastPt.y);

            // Subtle gradient depth fill under wave
            if (layer.fill) {
                ctx.lineTo(width, height);
                ctx.lineTo(0, height);
                ctx.closePath();

                const gradFill = ctx.createLinearGradient(0, baseY - layer.amp, 0, height);
                gradFill.addColorStop(0, layer.color);
                gradFill.addColorStop(0.35, 'rgba(4, 56, 210, 0.04)');
                gradFill.addColorStop(1, 'rgba(4, 56, 210, 0.0)');
                ctx.fillStyle = gradFill;
                ctx.fill();

                // Re-trace stroke for crisp crest
                ctx.beginPath();
                ctx.moveTo(points[0].x, points[0].y);
                for (let i = 1; i < points.length - 1; i++) {
                    const xc = (points[i].x + points[i + 1].x) / 2;
                    const yc = (points[i].y + points[i + 1].y) / 2;
                    ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
                }
                ctx.lineTo(lastPt.x, lastPt.y);
            }

            ctx.strokeStyle = layer.color;
            ctx.lineWidth = layer.width;
            ctx.lineCap = 'round';
            ctx.stroke();
        });

        // 3. Draw Propagating Water Ripple Rings
        for (let rIdx = 0; rIdx < ripples.length; rIdx++) {
            const r = ripples[rIdx];
            ctx.beginPath();
            ctx.arc(r.x, r.y, r.radius, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(56, 189, 248, ${0.35 * r.life * r.strength})`;
            ctx.lineWidth = 1.6 * r.life;
            ctx.stroke();

            // Inner subtle secondary echo ring
            if (r.radius > 25) {
                ctx.beginPath();
                ctx.arc(r.x, r.y, Math.max(0, r.radius - 18), 0, Math.PI * 2);
                ctx.strokeStyle = `rgba(2, 132, 199, ${0.2 * r.life * r.strength})`;
                ctx.lineWidth = 1.0 * r.life;
                ctx.stroke();
            }
        }

        // 4. Update & Draw Hydrodynamic Tracer Particles
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];

            // Record trail
            p.trail.push({ x: p.x, y: p.y });
            if (p.trail.length > 5) p.trail.shift();

            // Flow eastward
            p.x += p.vx;

            // Flow vertical undulation along river current
            p.y = (height * p.baseYRel) + Math.sin(p.x * 0.002 + time * 0.001) * 22;

            // Fluid deflection near mouse
            if (mouse.x > -500) {
                const pdx = p.x - mouse.x;
                const pdy = p.y - mouse.y;
                const pdist = Math.sqrt(pdx * pdx + pdy * pdy);
                if (pdist < 160 && pdist > 0.001) {
                    const repel = (1 - pdist / 160) * 2.5;
                    p.x += (pdx / pdist) * repel;
                    p.y += (pdy / pdist) * repel;
                }
            }

            // Wrap around screen horizontally
            if (p.x > width + 25) {
                p.x = -20;
                p.baseYRel = 0.15 + Math.random() * 0.75;
                p.trail.length = 0;
            }

            // Render Particle Trail
            if (p.trail.length > 1) {
                ctx.beginPath();
                ctx.moveTo(p.trail[0].x, p.trail[0].y);
                for (let t = 1; t < p.trail.length; t++) {
                    ctx.lineTo(p.trail[t].x, p.trail[t].y);
                }
                ctx.strokeStyle = `rgba(56, 189, 248, ${p.alpha * 0.35})`;
                ctx.lineWidth = p.size * 0.8;
                ctx.stroke();
            }

            // Render Particle Glow
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(224, 242, 254, ${p.alpha})`;
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0; // reset
        }

        animId = requestAnimationFrame(render);
    }

    function start() {
        if (isRunning) return;
        isRunning = true;
        resize();
        animId = requestAnimationFrame(render);
    }

    function stop() {
        if (!isRunning) return;
        isRunning = false;
        if (animId) {
            cancelAnimationFrame(animId);
            animId = null;
        }
    }

    // Auto-pause when hero-section has .hidden class to free 100% GPU/CPU for 3D simulation
    const observer = new MutationObserver(() => {
        if (heroSection.classList.contains('hidden')) {
            stop();
        } else {
            start();
        }
    });

    observer.observe(heroSection, { attributes: true, attributeFilter: ['class'] });

    // Initial start if hero is visible
    if (!heroSection.classList.contains('hidden')) {
        start();
    }

    return {
        start,
        stop,
        resize
    };
}
