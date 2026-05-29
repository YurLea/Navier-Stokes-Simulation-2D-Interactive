import { getUI, bindUI } from './ui.js';
import { createPointerController } from './input.js';
import { createFullscreenVAO } from './glUtils.js';
import { createPrograms, rebuildSimulation, clearSimulation, stepSimulation } from './simulation.js';
import { renderComposite } from './render.js';

const canvas = document.getElementById('glcanvas');
const gl = canvas.getContext('webgl2', {
    alpha: true,
    antialias: false,
    premultipliedAlpha: false,
    preserveDrawingBuffer: false,
});

if (!gl) {
    alert('WebGL2 не поддерживается');
    throw new Error('WebGL2 not supported');
}

const extColorFloat = gl.getExtension('EXT_color_buffer_float');
const extLinearFloat =
    gl.getExtension('OES_texture_half_float_linear') ||
    gl.getExtension('OES_texture_float_linear');

if (!extColorFloat) {
    alert('Нужен EXT_color_buffer_float');
}

gl.disable(gl.DEPTH_TEST);
gl.disable(gl.BLEND);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

// ------------------------------------------------------------
// State
// ------------------------------------------------------------
const state = {
    resolution: 1024,
    iterations: 50,
    dt: 0.003,
    velocityDissipation: 0.9995,
    dyeDissipation: 0.9995,
    splatRadius: 0.017,
    forceMultiplier: 30.0,
    obstacleEnabled: true,
    obstacleCenter01: [0.5, 0.5],
    obstacleRadius01: 0.04,
    noSlip: true,
    obstacleBoundaryPixels: 3.0,
    gradientRotation: 0.0,
};

// ------------------------------------------------------------
// Setup
// ------------------------------------------------------------
const ui = getUI();
const pointer = createPointerController(canvas);
const vaoObj = createFullscreenVAO(gl);
const programs = createPrograms(gl);

let sim = null;

function resizeCanvasToDisplaySize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);

    if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
    }
}

function rebuild() {
    sim = rebuildSimulation(gl, state, !!extLinearFloat);
}

function reset() {
    if (!sim) return;
    clearSimulation(gl, sim);
}

bindUI({
    state,
    ui,
    onResolutionChange: rebuild,
    onReset: reset,
});

window.addEventListener('resize', resizeCanvasToDisplaySize);

resizeCanvasToDisplaySize();
rebuild();

// ------------------------------------------------------------
// Main loop
// ------------------------------------------------------------
function frame() {
    resizeCanvasToDisplaySize();

    stepSimulation(gl, vaoObj, programs, sim, state, pointer);
    renderComposite(gl, vaoObj, programs, sim, state);

    requestAnimationFrame(frame);
}

frame();