/**
 * Prajkit Premium Interactions - Cyber Luxe Edition
 */

document.addEventListener('DOMContentLoaded', () => {
    initParticles();
    initTilt();
    initScramble();
    initReveals();
    initStats();
    initNavbar();
});

// 1. Stars and Space Background
function initParticles() {
    const canvas = document.createElement('canvas');
    canvas.id = 'particles-canvas';
    document.body.prepend(canvas); // Put it behind everything properly
    const ctx = canvas.getContext('2d');

    let stars = [];
    let movingStars = [];
    let width, height;

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

            ctx.fillStyle = `rgba(255, 255, 255, ${Math.abs(this.opacity)})`;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
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
            const px = this.x * scale + width / 2;
            const py = this.y * scale + height / 2;
            const alpha = Math.min(1, (1 - this.z / width) * 2);

            if (px < 0 || px > width || py < 0 || py > height) return;

            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(px, py, this.size * scale, 0, Math.PI * 2);
            ctx.fill();

            // Subtle trail
            ctx.strokeStyle = `rgba(255, 255, 255, ${alpha * 0.3})`;
            ctx.lineWidth = this.size * scale * 0.5;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(px - (this.x * 0.02) * scale, py - (this.y * 0.02) * scale);
            ctx.stroke();
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
        const starCount = Math.floor((width * height) / 4000);
        for (let i = 0; i < starCount; i++) stars.push(new Star());
        for (let i = 0; i < 150; i++) movingStars.push(new MovingStar());
    }

    function animate() {
        ctx.fillStyle = '#010103'; // Pure deep space black
        ctx.fillRect(0, 0, width, height);

        // Draw static twinkling stars
        stars.forEach(s => s.draw());

        // Draw moving starfield
        movingStars.forEach(ms => {
            ms.update();
            ms.draw();
        });

        // Occasional shooting star
        if (Math.random() < 0.01 && !shootingStar.active) {
            shootingStar.trigger();
        }
        shootingStar.draw();

        // Add multiple layers of nebula glow
        const gradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 1.2);
        gradient.addColorStop(0, 'rgba(30, 10, 60, 0.1)'); // Darker violet
        gradient.addColorStop(0.5, 'rgba(10, 0, 30, 0.03)'); // Very faint
        gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    animate();
}

// 3. 3D Tilt Effect
function initTilt() {
    const cards = document.querySelectorAll('.service-card');

    cards.forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const centerX = rect.width / 2;
            const centerY = rect.height / 2;

            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;

            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
        });

        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateZ(0)';
        });
    });
}

// 4. Text Scramble Effect
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

// 5. Reveal Animations
function initReveals() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll('.reveal, .service-card, .stat-item').forEach(el => {
        el.classList.add('reveal');
        observer.observe(el);
    });
}

// 6. Stats Counter
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

// 7. Sticky Navbar
function initNavbar() {
    const nav = document.querySelector('.navbar');
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            nav.classList.add('scrolled');
        } else {
            nav.classList.remove('scrolled');
        }
    });
}