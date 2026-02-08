const canvas = document.getElementById('canvas');
const gl = canvas.getContext('webgl');

if (!gl) {
    alert('WebGL not supported');
}

// Shader Source
const vs = `
attribute vec2 position;
void main() {
    gl_Position = vec4(position, 0.0, 1.0);
}
`;

const fs = `
precision highp float;
uniform vec2 u_resolution;
uniform vec2 u_mouse;
uniform float u_time;

float random(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution.xy;
    vec2 mouse = u_mouse / u_resolution.xy;
    float aspect = u_resolution.x / u_resolution.y;
    
    vec2 p = uv - mouse;
    p.x *= aspect;
    float r = length(p);

    // Gravitational Lensing (Schwarzschild-like warp)
    float Rs = 0.045; 
    float lensed_r;
    
    if (r < Rs) {
        lensed_r = 0.0;
    } else {
        lensed_r = r * (1.0 - Rs / r);
    }

    vec2 lensed_p = p * (lensed_r / max(r, 0.0001));
    vec2 lensed_uv = mouse + vec2(lensed_p.x / aspect, lensed_p.y);

    // Empty Space - Pure Black Background
    vec3 color = vec3(0.0);

    // Accretion Disk Visuals
    float disk = 0.0;
    float disk_inner = Rs * 1.2;
    float disk_outer = Rs * 5.0;
    
    if (r > disk_inner && r < disk_outer) {
        float angle = atan(p.y, p.x);
        float dist_fac = (r - disk_inner) / (disk_outer - disk_inner);
        
        float swirl = angle + u_time * 4.0 + r * 20.0;
        float n = noise(vec2(swirl * 2.0, r * 30.0 - u_time * 4.0));
        
        disk = smoothstep(1.0, 0.0, dist_fac) * smoothstep(0.0, 0.08, dist_fac);
        disk *= (0.2 + 0.8 * n);
        disk *= pow(1.0 - dist_fac, 1.5);
    }

    // Event Horizon Shadow & Photon Sphere
    float hole = 1.0 - smoothstep(Rs - 0.002, Rs + 0.002, r);
    float photon_sphere = smoothstep(Rs * 1.5, Rs * 1.48, r) * smoothstep(Rs * 1.45, Rs * 1.48, r);
    
    // Core glow (Bloom)
    float core_glow = 0.012 / (r - Rs + 0.006);
    core_glow = clamp(core_glow, 0.0, 1.0) * (1.0 - hole);

    // Color Composition
    vec3 disk_color = vec3(1.0, 0.45, 0.1) * disk; 
    vec3 glow_color = vec3(1.0, 1.0, 1.0) * core_glow * 0.4;
    
    color += disk_color;
    color += glow_color;
    color += vec3(1.0, 0.95, 0.9) * photon_sphere * 0.9;
    
    color *= (1.0 - hole); // The Void

    gl_FragColor = vec4(color, 1.0);
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vsSource, fsSource) {
    const vsShader = createShader(gl, gl.VERTEX_SHADER, vsSource);
    const fsShader = createShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = gl.createProgram();
    gl.attachShader(program, vsShader);
    gl.attachShader(program, fsShader);
    gl.linkProgram(program);
    return program;
}

const program = createProgram(gl, vs, fs);
const posLoc = gl.getAttribLocation(program, 'position');
const resLoc = gl.getUniformLocation(program, 'u_resolution');
const mouseLoc = gl.getUniformLocation(program, 'u_mouse');
const timeLoc = gl.getUniformLocation(program, 'u_time');

const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let lerpMouse = { x: mouse.x, y: mouse.y };

window.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
});

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    gl.viewport(0, 0, canvas.width, canvas.height);
}
window.addEventListener('resize', resize);
resize();

function render(time) {
    time *= 0.001;

    // Smooth mouse movement
    lerpMouse.x += (mouse.x - lerpMouse.x) * 0.15;
    lerpMouse.y += (mouse.y - lerpMouse.y) * 0.15;

    // WebGL Shader
    gl.useProgram(program);
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(resLoc, canvas.width, canvas.height);
    gl.uniform2f(mouseLoc, lerpMouse.x, canvas.height - lerpMouse.y);
    gl.uniform1f(timeLoc, time);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    requestAnimationFrame(render);
}

requestAnimationFrame(render);
