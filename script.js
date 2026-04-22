/**
 * Prajkit Premium Interactions — Neo-Minimalist Cinematic Edition
 */

document.addEventListener('DOMContentLoaded', () => {
    const isTouchDevice = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const hasMousePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const performanceQuality = detectPerformanceQuality();

    if (!isTouchDevice && hasMousePointer) {
        document.body.classList.add('custom-cursor-enabled');
        if (performanceQuality === 'high' || performanceQuality === 'medium') {
            initBlackhole();
        }
    }

    if (performanceQuality !== 'low') {
        initParticles(isTouchDevice);
    }

    initScanlineOverlay();
    initScramble();
    initStaggeredReveals();
    initStats();
    initSmartNavbar();
    initMobileMenu();
    initContactForm();
    initPricingButtons();
    initSmoothScrollLinks();
});

/**
 * Detect device performance quality
 */
function detectPerformanceQuality() {
    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 4;
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    const hasWebGL = !!gl;

    let score = 0;
    if (cores >= 8) score += 3;
    else if (cores >= 4) score += 2;
    else score += 1;

    if (memory >= 8) score += 3;
    else if (memory >= 4) score += 2;
    else score += 1;

    if (hasWebGL) score += 2;

    if (score >= 7) return 'high';
    if (score >= 4) return 'medium';
    return 'low';
}

let globalMouse = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
    globalMouse.x = e.clientX;
    globalMouse.y = e.clientY;
});

/**
 * Add scanline overlay element to the DOM
 */
function initScanlineOverlay() {
    const scanline = document.createElement('div');
    scanline.id = 'scanline-overlay';
    document.body.appendChild(scanline);
}

/**
 * Blackhole WebGL cursor
 */
function initBlackhole() {
    const canvas = document.createElement('canvas');
    canvas.id = 'blackhole-canvas';
    document.body.prepend(canvas);

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    const vs = `
        attribute vec2 position;
        void main() { gl_Position = vec4(position, 0.0, 1.0); }
    `;

    const fs = `
            precision highp float;
            uniform vec2 u_resolution;
            uniform vec2 u_mouse;
            uniform float u_time;
            uniform float u_hover;

            #define PI 3.14159265359

            float hash(vec2 p) {
                p = fract(p * vec2(123.34, 456.21));
                p += dot(p, p + 45.32);
                return fract(p.x * p.y);
            }

            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                float a = hash(i);
                float b = hash(i + vec2(1.0, 0.0));
                float c = hash(i + vec2(0.0, 1.0));
                float d = hash(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            float fbm(vec2 p) {
                float v = 0.0;
                float a = 0.5;
                for (int i = 0; i < 5; i++) {
                    v += a * noise(p);
                    p *= 2.1;
                    a *= 0.45;
                }
                return v;
            }

            float dither(vec2 uv) {
                return (hash(uv) - 0.5) * (1.0 / 255.0);
            }

            float starfield(vec2 uv) {
                vec2 grid = floor(uv * 70.0);
                vec2 f = fract(uv * 70.0);
                float h = hash(grid);
                if (h > 0.988) {
                    float pulse = 0.4 + 0.6 * sin(u_time * 1.5 + h * 100.0);
                    return smoothstep(0.1, 0.0, length(f - 0.5)) * pulse;
                }
                return 0.0;
            }

            void main() {
                vec2 uv = (gl_FragCoord.xy * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                vec2 mouse = (u_mouse * 2.0 - u_resolution.xy) / min(u_resolution.x, u_resolution.y);
                
                vec2 p = uv - mouse;
                float r = length(p);
                float phi = atan(p.y, p.x);

                float Rs = 0.025 + u_hover * 0.015;
                float photonSphere = 1.6 * Rs;
                
                float lensing = 1.0 - (Rs / max(r, 0.0001));
                
                float disk = 0.0;
                float dInner = Rs * 2.4;
                float dOuter = Rs * 8.5;
                
                vec3 diskColor = vec3(0.0);

                if (r > Rs * 0.8) {
                    float angleForDisk = phi - u_time * 1.1 - 3.2/r;
                    vec2 gasUV = vec2(angleForDisk * 1.6, r * 22.0);

                    float gas1 = fbm(gasUV * 0.7 + u_time * 0.15);
                    float gas2 = fbm(gasUV * 3.0 - u_time * 0.4);
                    float gas = mix(gas1, gas2, 0.35);

                    float horizontalProximity = abs(p.y - p.x * 0.1) / (r + 0.001); 
                    float planeMask = smoothstep(0.025, 0.0, horizontalProximity) * 
                                     smoothstep(dOuter, dInner, r) * 
                                     smoothstep(Rs, dInner, r);
                    
                    float streaks = smoothstep(0.005, 0.0, horizontalProximity) * 
                                   (0.5 + 0.5 * sin(r * 400.0 - u_time * 10.0)) * planeMask;

                    float arcDist = abs(r - Rs * 3.2);
                    float arcMask = smoothstep(Rs * 1.1, 0.0, arcDist) * 
                                   smoothstep(0.02, 0.85, abs(p.y)/r);

                    disk = max(planeMask * 1.4, arcMask * 0.85) * (0.2 + 0.8 * gas);
                    disk += streaks * 0.4;
                    
                    float doppler = cos(phi + 0.4); 
                    vec3 hotColor = vec3(1.0, 0.98, 0.9); 
                    vec3 midColor = vec3(1.0, 0.55, 0.15);
                    vec3 coolColor = vec3(0.85, 0.25, 0.05);
                    
                    float heat = smoothstep(dOuter, dInner, r);
                    vec3 baseCol = mix(coolColor, midColor, heat);
                    baseCol = mix(baseCol, hotColor, pow(heat, 4.0));
                    
                    vec3 doppCol = baseCol;
                    doppCol.b += doppler * 0.45;
                    doppCol.r -= doppler * 0.15;
                    
                    diskColor = doppCol * disk * (1.3 + doppler * 0.8);
                    
                    float ring = smoothstep(0.0012, 0.0, abs(r - photonSphere));
                    diskColor += vec3(1.0, 1.0, 1.0) * ring * 2.8;
                }

                vec2 starUV = p * lensing + mouse;
                float stars = starfield(starUV * 0.45);
                
                float hole = smoothstep(Rs + 0.002, Rs - 0.001, r);
                vec3 finalColor = diskColor;
                finalColor += vec3(0.98, 0.98, 1.0) * stars * (1.0 - hole);
                
                float glowStrength = 0.6 + u_hover * 0.4;
                float glow = (0.01 + u_hover * 0.005) / (r - Rs + 0.004);
                finalColor += vec3(1.0, 0.4, 0.05) * glow * glowStrength * (1.0 - hole);
                finalColor += dither(gl_FragCoord.xy);

                float alpha = clamp(length(finalColor) * 1.8 + hole, 0.0, 1.0);
                gl_FragColor = vec4(finalColor * (1.0 - hole), alpha);
            }
        `;

    function createShader(gl, type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        return shader;
    }

    const program = gl.createProgram();
    gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vs));
    gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        return;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const posLoc = gl.getAttribLocation(program, 'position');
    const resLoc = gl.getUniformLocation(program, 'u_resolution');
    const mouseLoc = gl.getUniformLocation(program, 'u_mouse');
    const timeLoc = gl.getUniformLocation(program, 'u_time');
    const hoverLoc = gl.getUniformLocation(program, 'u_hover');

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    let lerpMouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let hoverState = 0;
    let targetHover = 0;

    const interactiveElements = 'a, button, .service-card, .btn, .nav-link, input, textarea';

    document.addEventListener('mouseover', (e) => {
        if (e.target.closest(interactiveElements)) {
            targetHover = 1;
        }
    });

    document.addEventListener('mouseout', (e) => {
        if (!e.target.closest(interactiveElements)) {
            targetHover = 0;
        }
    });

    function resize() {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
    window.addEventListener('resize', resize);
    resize();

    function render(time) {
        time *= 0.001;

        lerpMouse.x += (globalMouse.x - lerpMouse.x) * 0.25;
        lerpMouse.y += (globalMouse.y - lerpMouse.y) * 0.25;

        hoverState += (targetHover - hoverState) * 0.15;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(program);
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        gl.uniform2f(resLoc, canvas.width, canvas.height);
        gl.uniform2f(mouseLoc, lerpMouse.x * dpr, canvas.height - lerpMouse.y * dpr);
        gl.uniform1f(timeLoc, time);
        gl.uniform1f(hoverLoc, hoverState);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        requestAnimationFrame(render);
    }
    render(0);
}

/**
 * Stars and Space Background
 */
function initParticles(isMobile = false) {
    const canvas = document.createElement('canvas');
    canvas.id = 'particles-canvas';
    document.body.prepend(canvas);
    const ctx = canvas.getContext('2d');

    let stars = [];
    let movingStars = [];
    let width, height;

    const particleDensity = isMobile ? 6000 : 4000;
    const movingStarCount = isMobile ? 80 : 150;

    function resize() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        initStars();
    }

    class Star {
        constructor() {
            this.x = Math.random() * width;
            this.y = Math.random() * height;
            this.size = Math.random() * 1.5;
            this.opacity = Math.random();
            this.speed = Math.random() * 0.02;
        }
        draw() {
            this.opacity += this.speed;
            if (this.opacity > 1 || this.opacity < 0) this.speed *= -1;

            let px = this.x;
            let py = this.y;
            let size = this.size;

            if (!isMobile && globalMouse.x !== 0) {
                const dx = this.x - globalMouse.x;
                const dy = this.y - globalMouse.y;
                const r = Math.sqrt(dx * dx + dy * dy);

                if (r < 150) {
                    const lens = 1200 / (r + 25);
                    px += (dx / r) * lens;
                    py += (dy / r) * lens;
                    size *= (1 + lens / 60);
                }
            }

            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(this.opacity)})`;
            ctx.beginPath();
            ctx.arc(px, py, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    class MovingStar {
        constructor() {
            this.reset();
        }
        reset() {
            this.x = (Math.random() - 0.5) * width * 2;
            this.y = (Math.random() - 0.5) * height * 2;
            this.z = Math.random() * width;
            this.size = Math.random() * 1.5 + 0.5;
            this.speed = Math.random() * 2 + 1;
        }
        update() {
            this.z -= this.speed;
            if (this.z <= 0) this.reset();
        }
        draw() {
            const scale = 500 / this.z;
            let px = this.x * scale + width / 2;
            let py = this.y * scale + height / 2;

            if (!isMobile && globalMouse.x !== 0) {
                const dx = px - globalMouse.x;
                const dy = py - globalMouse.y;
                const r = Math.sqrt(dx * dx + dy * dy);

                if (r < 150) {
                    const lens = 1500 / (r + 30);
                    px += (dx / r) * lens;
                    py += (dy / r) * lens;
                }
            }

            const alpha = Math.min(1, (1 - this.z / width) * 2);

            if (px < 0 || px > width || py < 0 || py > height) return;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, this.size * scale, 0, Math.PI * 2);
            ctx.fill();

            if (!isMobile) {
                ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
                ctx.lineWidth = this.size * scale * 0.5;
                ctx.beginPath();
                ctx.moveTo(px, py);
                ctx.lineTo(px - (this.x * 0.02) * scale, py - (this.y * 0.02) * scale);
                ctx.stroke();
            }
        }
    }

    class ShootingStar {
        constructor() {
            this.reset();
            this.active = false;
        }
        reset() {
            this.x = Math.random() * width;
            this.y = Math.random() * height * 0.5;
            this.len = Math.random() * 80 + 50;
            this.speed = Math.random() * 10 + 10;
            this.opacity = 1;
        }
        draw() {
            if (!this.active) return;

            ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.len, this.y + this.len);
            ctx.stroke();

            this.x -= this.speed;
            this.y += this.speed;
            this.opacity -= 0.02;

            if (this.opacity <= 0 || this.x < -this.len || this.y > height + this.len) {
                this.active = false;
            }
        }
        trigger() {
            this.reset();
            this.active = true;
        }
    }

    let shootingStar = new ShootingStar();

    function initStars() {
        stars = [];
        movingStars = [];
        const starCount = Math.floor((width * height) / particleDensity);
        for (let i = 0; i < starCount; i++) stars.push(new Star());
        for (let i = 0; i < movingStarCount; i++) movingStars.push(new MovingStar());
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        stars.forEach(s => s.draw());
        movingStars.forEach(ms => {
            ms.update();
            ms.draw();
        });

        if (Math.random() < 0.01 && !shootingStar.active) {
            shootingStar.trigger();
        }
        shootingStar.draw();

        const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 1.2);
        gradient.addColorStop(0, 'rgba(30, 10, 60, 0.1)');
        gradient.addColorStop(0.5, 'rgba(10, 0, 30, 0.03)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
}

/**
 * Text Scramble Effect
 */
function initScramble() {
    class TextScramble {
        constructor(el) {
            this.el = el;
            this.chars = '!<>-_\\/[]{}—=+*^?#________';
            this.update = this.update.bind(this);
        }
        setText(newText) {
            const oldText = this.el.innerText;
            const length = Math.max(oldText.length, newText.length);
            const promise = new Promise((resolve) => this.resolve = resolve);
            this.queue = [];
            for (let i = 0; i < length; i++) {
                const from = oldText[i] || '';
                const to = newText[i] || '';
                const start = Math.floor(Math.random() * 40);
                const end = start + Math.floor(Math.random() * 40);
                this.queue.push({ from, to, start, end });
            }
            cancelAnimationFrame(this.frameRequest);
            this.frame = 0;
            this.update();
            return promise;
        }
        update() {
            let output = '';
            let complete = 0;
            for (let i = 0, n = this.queue.length; i < n; i++) {
                let { from, to, start, end, char } = this.queue[i];
                if (this.frame >= end) {
                    complete++;
                    output += to;
                } else if (this.frame >= start) {
                    if (!char || Math.random() < 0.28) {
                        char = this.randomChar();
                        this.queue[i].char = char;
                    }
                    output += `<span class="dud-char" style="color:#FF6600">${char}</span>`;
                } else {
                    output += from;
                }
            }
            this.el.innerHTML = output;
            if (complete === this.queue.length) {
                this.resolve();
            } else {
                this.frameRequest = requestAnimationFrame(this.update);
                this.frame++;
            }
        }
        randomChar() {
            return this.chars[Math.floor(Math.random() * this.chars.length)];
        }
    }

    const titleEl = document.querySelector('.hero-title');
    if (titleEl) {
        const fx = new TextScramble(titleEl);
        const originalText = titleEl.innerText;
        fx.setText(originalText);
    }
}

/**
 * Staggered Reveal Animations using IntersectionObserver
 * Uses clip-path sliding drawer effect defined in CSS
 */
function initStaggeredReveals() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -40px 0px' });

    document.querySelectorAll('.reveal, .service-card, .stat-item').forEach(el => {
        if (!el.classList.contains('reveal')) {
            el.classList.add('reveal');
        }
        observer.observe(el);
    });

    // Add stagger class to grid containers
    document.querySelectorAll('.services-grid, .portfolio-grid, .testimonials-grid, .stats-grid').forEach(grid => {
        grid.classList.add('reveal-stagger');
    });
}

/**
 * Stats Counter
 */
function initStats() {
    const stats = document.querySelectorAll('.stat-number');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const target = parseInt(entry.target.getAttribute('data-target'));
                animateValue(entry.target, 0, target, 2000);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.5 });

    stats.forEach(stat => observer.observe(stat));
}

function animateValue(obj, start, end, duration) {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

/**
 * Smart Navbar — Floating pill that hides on scroll-down, shows on scroll-up
 */
function initSmartNavbar() {
    const nav = document.querySelector('.navbar');
    let lastScrollY = window.scrollY;
    let ticking = false;

    function updateNavbar() {
        const currentScrollY = window.scrollY;

        if (currentScrollY > 80) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }

        if (currentScrollY > lastScrollY && currentScrollY > 200) {
            nav.classList.add('nav-hidden');
        } else {
            nav.classList.remove('nav-hidden');
        }

        lastScrollY = currentScrollY;
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateNavbar);
            ticking = true;
        }
    }, { passive: true });
}

/**
 * Mobile Hamburger Menu
 */
function initMobileMenu() {
    const hamburger = document.getElementById('hamburger');
    const navMenu = document.querySelector('.nav-menu');

    if (!hamburger || !navMenu) return;

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navMenu.classList.toggle('open');
        document.body.style.overflow = navMenu.classList.contains('open') ? 'hidden' : '';
    });

    navMenu.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navMenu.classList.remove('open');
            document.body.style.overflow = '';
        });
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && navMenu.classList.contains('open')) {
            hamburger.classList.remove('active');
            navMenu.classList.remove('open');
            document.body.style.overflow = '';
        }
    });
}

/**
 * Smooth scroll for anchor links with offset for floating navbar
 */
function initSmoothScrollLinks() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetEl = document.querySelector(targetId);
            if (!targetEl) return;

            e.preventDefault();
            const yOffset = -100;
            const y = targetEl.getBoundingClientRect().top + window.pageYOffset + yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
        });
    });
}

/**
 * Contact Form Validation and Submission
 */
function initContactForm() {
    const form = document.getElementById('contact-form');
    if (!form) return;

    const nameInput = document.getElementById('name');
    const emailInput = document.getElementById('email');
    const pricingPlanInput = document.getElementById('pricing-plan');
    const messageInput = document.getElementById('message');

    const nameError = document.getElementById('name-error');
    const emailError = document.getElementById('email-error');
    const messageError = document.getElementById('message-error');

    const submitBtn = form.querySelector('button[type="submit"]');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    const successMessage = document.getElementById('form-success');

    const urlParams = new URLSearchParams(window.location.search);
    const planParam = urlParams.get('plan');
    if (planParam && pricingPlanInput) {
        const decodedPlan = decodeURIComponent(planParam);

        let matched = false;
        for (let option of pricingPlanInput.options) {
            if (option.value === decodedPlan) {
                pricingPlanInput.value = decodedPlan;
                matched = true;
                break;
            }
        }

        if (!matched) {
            const planLower = decodedPlan.toLowerCase();

            let planLevel = '';
            if (planLower.includes('basic')) planLevel = 'Basic';
            else if (planLower.includes('standard')) planLevel = 'Standard';
            else if (planLower.includes('premium')) planLevel = 'Premium';

            const planCategory = decodedPlan.split(' - ')[0].trim();

            for (let option of pricingPlanInput.options) {
                if (!option.value || option.disabled) continue;

                const optionParts = option.value.split(' - ');
                if (optionParts.length < 2) continue;

                const optionCategory = optionParts[0].trim();
                const optionLevel = optionParts[1].split('(')[0].trim();

                if (optionCategory.toLowerCase() === planCategory.toLowerCase() &&
                    optionLevel.toLowerCase() === planLevel.toLowerCase()) {
                    pricingPlanInput.value = option.value;
                    matched = true;
                    break;
                }
            }
        }

        if (!matched && decodedPlan) {
            const tempOption = document.createElement('option');
            tempOption.value = decodedPlan;
            tempOption.textContent = decodedPlan;
            tempOption.selected = true;
            pricingPlanInput.appendChild(tempOption);
        }

        setTimeout(() => {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const yOffset = -100;
                const y = contactSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 300);
    } else if (window.location.hash === '#contact') {
        setTimeout(() => {
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                const yOffset = -100;
                const y = contactSection.getBoundingClientRect().top + window.pageYOffset + yOffset;
                window.scrollTo({ top: y, behavior: 'smooth' });
            }
        }, 300);
    }

    nameInput.addEventListener('blur', () => validateName());
    emailInput.addEventListener('blur', () => validateEmail());
    messageInput.addEventListener('blur', () => validateMessage());

    nameInput.addEventListener('input', () => clearError(nameInput, nameError));
    emailInput.addEventListener('input', () => clearError(emailInput, emailError));
    messageInput.addEventListener('input', () => clearError(messageInput, messageError));

    function validateName() {
        const value = nameInput.value.trim();
        const sanitized = value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');

        if (sanitized === '') {
            showError(nameInput, nameError, 'Name is required');
            return false;
        }
        if (sanitized.length < 2) {
            showError(nameInput, nameError, 'Name must be at least 2 characters');
            return false;
        }
        if (sanitized.length > 100) {
            showError(nameInput, nameError, 'Name must be less than 100 characters');
            return false;
        }
        clearError(nameInput, nameError);
        return true;
    }

    function validateEmail() {
        const value = emailInput.value.trim();
        const sanitized = value.replace(/<[^>]*>/g, '').replace(/[<>]/g, '');
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (sanitized === '') {
            showError(emailInput, emailError, 'Email is required');
            return false;
        }
        if (!emailRegex.test(sanitized)) {
            showError(emailInput, emailError, 'Please enter a valid email address');
            return false;
        }
        if (sanitized.length > 254) {
            showError(emailInput, emailError, 'Email address is too long');
            return false;
        }
        clearError(emailInput, emailError);
        return true;
    }

    function validateMessage() {
        const value = messageInput.value.trim();
        const sanitized = value.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

        if (sanitized === '') {
            showError(messageInput, messageError, 'Message is required');
            return false;
        }
        if (sanitized.length < 10) {
            showError(messageInput, messageError, 'Message must be at least 10 characters');
            return false;
        }
        if (sanitized.length > 5000) {
            showError(messageInput, messageError, 'Message must be less than 5000 characters');
            return false;
        }
        clearError(messageInput, messageError);
        return true;
    }

    function showError(input, errorElement, message) {
        input.classList.add('error');
        errorElement.textContent = message;
        input.setAttribute('aria-invalid', 'true');
    }

    function clearError(input, errorElement) {
        input.classList.remove('error');
        errorElement.textContent = '';
        input.setAttribute('aria-invalid', 'false');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const isNameValid = validateName();
        const isEmailValid = validateEmail();
        const isMessageValid = validateMessage();

        if (!isNameValid || !isEmailValid || !isMessageValid) {
            if (!isNameValid) nameInput.focus();
            else if (!isEmailValid) emailInput.focus();
            else if (!isMessageValid) messageInput.focus();
            return;
        }

        const sanitizedData = {
            name: nameInput.value.trim().replace(/<[^>]*>/g, '').substring(0, 100),
            email: emailInput.value.trim().replace(/<[^>]*>/g, '').substring(0, 254),
            'pricing-plan': pricingPlanInput.value.trim().replace(/<[^>]*>/g, ''),
            message: messageInput.value.trim().replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '').substring(0, 5000)
        };

        submitBtn.disabled = true;
        btnText.style.display = 'none';
        btnLoader.style.display = 'inline-flex';
        successMessage.style.display = 'none';

        try {
            const response = await fetch('https://formspree.io/f/manlrpdj', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(sanitizedData)
            });

            if (response.ok) {
                successMessage.style.display = 'flex';
                form.reset();

                submitBtn.disabled = false;
                btnText.style.display = 'inline';
                btnLoader.style.display = 'none';

                setTimeout(() => {
                    successMessage.style.display = 'none';
                }, 5000);
            } else {
                throw new Error('Form submission failed');
            }

        } catch (error) {
            const errorMsg = document.createElement('div');
            errorMsg.className = 'form-error';
            errorMsg.style.cssText = 'display: block; padding: 20px; background: rgba(255, 68, 68, 0.1); border: 1px solid rgba(255, 68, 68, 0.3); border-radius: 12px; color: #ff6666; margin-top: 20px;';
            errorMsg.textContent = 'There was an error sending your message. Please try again or contact us directly at contact@prajkit.com';
            form.appendChild(errorMsg);

            setTimeout(() => errorMsg.remove(), 5000);

            submitBtn.disabled = false;
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
        }
    });
}

/**
 * Initialize pricing buttons to auto-select plan on contact form
 */
function initPricingButtons() {
    const pricingCards = document.querySelectorAll('.pricing-card');

    const sectionMapping = {
        'Business & Company Website': 'Business Website',
        'E-Commerce & Sales Website': 'E-Commerce Website',
        'Media & Content Website': 'Media & Content Website',
        'Personal & Portfolio Website': 'Personal & Portfolio Website',
        'Government & NGO Website': 'Government & NGO Website',
        'Healthcare Website': 'Healthcare Website',
        'Real Estate Website': 'Real Estate Website',
        'Travel & Tourism Website': 'Travel & Tourism Website',
        'Finance & Legal Website': 'Finance & Legal Website',
        'Community & Social Platform': 'Community & Social Platform',
        'Technology & Software Company': 'Technology & Software Company',
        'On Demand Services': 'On Demand Services',
        'Religious & Cultural Website': 'Religious & Cultural Website',
        'Custom & Advanced Solutions': 'Custom & Advanced Solutions',
        'Education Website': 'Education Website',
        'Mobile Application Development': 'Mobile Application',
        'Web Application Development': 'Web Application',
        'Business & Enterprise Systems': 'Enterprise System',
        'E-Commerce Application': 'E-Commerce App',
        'Industry-Specific Applications': 'Industry-Specific App',
        'Admin Dashboards & Internal Systems': 'Admin Dashboard',
        'Advanced & Emerging Solutions': 'Emerging Tech',
        'AI Agent Solutions': 'AI Agent Solutions'
    };

    pricingCards.forEach(card => {
        const ctaBtn = card.querySelector('.cta-btn');
        if (!ctaBtn) return;

        const packageName = card.querySelector('.package-name')?.textContent.trim();
        const packagePrice = card.querySelector('.package-price')?.textContent.trim();
        const sectionTitleElement = card.closest('.pricing-section')?.querySelector('.section-title');

        if (packageName && packagePrice && sectionTitleElement) {
            const fullTitle = sectionTitleElement.textContent.replace(/\s+/g, ' ').trim();
            const mappedTitle = sectionMapping[fullTitle] || fullTitle;

            const normalizedPrice = packagePrice
                .replace(/NPR\s+(\d+),(\d+),(\d+)-(\d+),(\d+),(\d+)\+?/g, (match, h1, t1, o1, h2, t2, o2) => {
                    return `NPR ${h1}${t1}K-${h2}${t2}K${match.includes('+') ? '+' : ''}`;
                })
                .replace(/NPR\s+(\d+),(\d+),(\d+)\+?/g, (match, h, t, o) => {
                    return `NPR ${h}${t}K${match.includes('+') ? '+' : ''}`;
                })
                .replace(/NPR\s+(\d+),(\d+)-(\d+),(\d+)/g, 'NPR $1$2K-$3$4K')
                .replace(/NPR\s+(\d+),(\d+)/g, 'NPR $1$2K');

            const planString = `${mappedTitle} - ${packageName} (${normalizedPrice})`;

            const encodedPlan = encodeURIComponent(planString);

            ctaBtn.addEventListener('click', (e) => {
                e.preventDefault();
                window.location.href = `index.html?plan=${encodedPlan}#contact`;
            });
        }
    });
}
