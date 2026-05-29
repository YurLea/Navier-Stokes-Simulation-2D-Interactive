import {
    makeProgram,
    makePingPong,
    makeTarget,
    clearTarget,
    draw,
} from './glUtils.js';

import {
    VS,
    ADVECT_FS,
    DIVERGENCE_FS,
    JACOBI_FS,
    SUBTRACT_FS,
    SPLAT_FS,
    COMPOSITE_FS,
} from './shaders.js';

function setObstacleUniformsSim(gl, u, state) {
    gl.uniform1f(u.uObstacleEnabled, state.obstacleEnabled ? 1.0 : 0.0);
    gl.uniform2f(
        u.uObstacleCenterUV,
        state.obstacleCenter01[0],
        state.obstacleCenter01[1]
    );
    gl.uniform1f(u.uObstacleRadiusUV, state.obstacleRadius01);
    gl.uniform1f(u.uObstacleBoundaryUV, state.obstacleBoundaryPixels / state.resolution);
    gl.uniform1f(u.uNoSlip, state.noSlip ? 1.0 : 0.0);
}

function setSimCommon(gl, u, state) {
    gl.uniform2f(u.uResolution, state.resolution, state.resolution);
    setObstacleUniformsSim(gl, u, state);
}

export function createPrograms(gl) {
    return {
        advect: makeProgram(gl, VS, ADVECT_FS, [
            'uVelocityTex', 'uFieldTex',
            'uDt', 'uDissipation', 'uIsVelocity',
            'uResolution', 'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uObstacleBoundaryUV', 'uNoSlip',
        ]),
        divergence: makeProgram(gl, VS, DIVERGENCE_FS, [
            'uVelocityTex',
            'uResolution', 'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uObstacleBoundaryUV', 'uNoSlip',
        ]),
        jacobi: makeProgram(gl, VS, JACOBI_FS, [
            'uPressureTex', 'uDivergenceTex',
            'uAlpha', 'uRBeta',
            'uResolution', 'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uObstacleBoundaryUV', 'uNoSlip',
        ]),
        subtract: makeProgram(gl, VS, SUBTRACT_FS, [
            'uVelocityTex', 'uPressureTex',
            'uResolution', 'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uObstacleBoundaryUV', 'uNoSlip',
        ]),
        splat: makeProgram(gl, VS, SPLAT_FS, [
            'uSourceTex',
            'uPoint', 'uForce', 'uColor', 'uRadius', 'uIsVelocity', 'uAspect',
            'uResolution', 'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uObstacleBoundaryUV', 'uNoSlip',
        ]),
        composite: makeProgram(gl, VS, COMPOSITE_FS, [
            'uMainTex',
            'uAspect', 'uGradientRotation',
            'uObstacleEnabled', 'uObstacleCenterUV', 'uObstacleRadiusUV',
            'uColRed', 'uColGreen', 'uColBlue',
            'uOutlineColor', 'uOutlineWidth', 'uEdgeSoftness',
        ]),
    };
}

export function rebuildSimulation(gl, state, linearFloatSupported) {
    const res = state.resolution;

    const sim = {
        velocity: makePingPong(gl, res, res, gl.RG16F, gl.RG, gl.HALF_FLOAT, linearFloatSupported),
        dye: makePingPong(gl, res, res, gl.RGBA16F, gl.RGBA, gl.HALF_FLOAT, linearFloatSupported),
        pressure: makePingPong(gl, res, res, gl.R16F, gl.RED, gl.HALF_FLOAT, linearFloatSupported),
        divergence: makeTarget(gl, res, res, gl.R16F, gl.RED, gl.HALF_FLOAT, linearFloatSupported),
    };

    clearSimulation(gl, sim);
    return sim;
}

export function clearSimulation(gl, sim) {
    clearTarget(gl, sim.velocity.read);
    clearTarget(gl, sim.velocity.write);
    clearTarget(gl, sim.dye.read);
    clearTarget(gl, sim.dye.write);
    clearTarget(gl, sim.pressure.read);
    clearTarget(gl, sim.pressure.write);
    clearTarget(gl, sim.divergence);
}

export function stepSimulation(gl, vaoObj, programs, sim, state, pointer) {
    if (!sim) return;

    const width = Math.max(1, gl.drawingBufferWidth);
    const height = Math.max(1, gl.drawingBufferHeight);

    // shared setup for sim passes
    const setCommon = (u) => setSimCommon(gl, u, state);

    // splat
    if (pointer.down) {
        const dx = pointer.x - pointer.prevX;
        const dy = pointer.y - pointer.prevY;

        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;

        const point = [
            pointer.x / width,
            pointer.y / height,
        ];

        const force = [
            (dx / width) * state.forceMultiplier,
            (dy / height) * state.forceMultiplier,
        ];

        // velocity splat
        draw(gl, vaoObj, programs.splat, sim.velocity.write, (u) => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
            gl.uniform1i(u.uSourceTex, 0);

            gl.uniform2f(u.uPoint, point[0], point[1]);
            gl.uniform2f(u.uForce, force[0], force[1]);
            gl.uniform4f(u.uColor, 0, 0, 0, 0);
            gl.uniform1f(u.uRadius, state.splatRadius * state.splatRadius);
            gl.uniform1f(u.uIsVelocity, 1.0);
            gl.uniform1f(u.uAspect, 1.0);

            setCommon(u);
        });
        sim.velocity.swap();

        // dye splat
        draw(gl, vaoObj, programs.splat, sim.dye.write, (u) => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sim.dye.read.texture);
            gl.uniform1i(u.uSourceTex, 0);

            gl.uniform2f(u.uPoint, point[0], point[1]);
            gl.uniform2f(u.uForce, 0.0, 0.0);
            gl.uniform4f(u.uColor, 0.8, 0.5, 0.1, 1.0);
            gl.uniform1f(u.uRadius, state.splatRadius * state.splatRadius);
            gl.uniform1f(u.uIsVelocity, 0.0);
            gl.uniform1f(u.uAspect, 1.0);

            setCommon(u);
        });
        sim.dye.swap();
    } else {
        pointer.prevX = pointer.x;
        pointer.prevY = pointer.y;
    }

    // 1) advect velocity
    draw(gl, vaoObj, programs.advect, sim.velocity.write, (u) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
        gl.uniform1i(u.uVelocityTex, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
        gl.uniform1i(u.uFieldTex, 1);

        gl.uniform1f(u.uDt, state.dt);
        gl.uniform1f(u.uDissipation, state.velocityDissipation);
        gl.uniform1f(u.uIsVelocity, 1.0);

        setCommon(u);
    });
    sim.velocity.swap();

    // 2) divergence
    draw(gl, vaoObj, programs.divergence, sim.divergence, (u) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
        gl.uniform1i(u.uVelocityTex, 0);

        setCommon(u);
    });

    // 3) pressure solve
    clearTarget(gl, sim.pressure.read);

    for (let i = 0; i < state.iterations; i++) {
        draw(gl, vaoObj, programs.jacobi, sim.pressure.write, (u) => {
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, sim.pressure.read.texture);
            gl.uniform1i(u.uPressureTex, 0);

            gl.activeTexture(gl.TEXTURE1);
            gl.bindTexture(gl.TEXTURE_2D, sim.divergence.texture);
            gl.uniform1i(u.uDivergenceTex, 1);

            const h = 1.0 / state.resolution;
            gl.uniform1f(u.uAlpha, -(h * h));
            gl.uniform1f(u.uRBeta, 0.25);

            setCommon(u);
        });
        sim.pressure.swap();
    }

    // 4) subtract gradient
    draw(gl, vaoObj, programs.subtract, sim.velocity.write, (u) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
        gl.uniform1i(u.uVelocityTex, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, sim.pressure.read.texture);
        gl.uniform1i(u.uPressureTex, 1);

        setCommon(u);
    });
    sim.velocity.swap();

    // 5) advect dye
    draw(gl, vaoObj, programs.advect, sim.dye.write, (u) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sim.velocity.read.texture);
        gl.uniform1i(u.uVelocityTex, 0);

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, sim.dye.read.texture);
        gl.uniform1i(u.uFieldTex, 1);

        gl.uniform1f(u.uDt, state.dt);
        gl.uniform1f(u.uDissipation, state.dyeDissipation);
        gl.uniform1f(u.uIsVelocity, 0.0);

        setCommon(u);
    });
    sim.dye.swap();
}