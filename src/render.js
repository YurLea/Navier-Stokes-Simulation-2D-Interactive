import { draw } from './glUtils.js';

export function renderComposite(gl, vaoObj, programs, sim, state) {
    if (!sim) return;

    draw(gl, vaoObj, programs.composite, null, (u) => {
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, sim.dye.read.texture);
        gl.uniform1i(u.uMainTex, 0);

        // square frame => aspect is 1
        gl.uniform1f(u.uAspect, 1.0);
        gl.uniform1f(u.uGradientRotation, state.gradientRotation);

        gl.uniform1f(u.uObstacleEnabled, state.obstacleEnabled ? 1.0 : 0.0);
        gl.uniform2f(u.uObstacleCenterUV, state.obstacleCenter01[0], state.obstacleCenter01[1]);
        gl.uniform1f(u.uObstacleRadiusUV, state.obstacleRadius01);

        gl.uniform4f(u.uColRed, 1.0, 0.0, 0.0, 1.0);
        gl.uniform4f(u.uColGreen, 0.0, 1.0, 0.0, 1.0);
        gl.uniform4f(u.uColBlue, 0.0, 0.0, 1.0, 1.0);

        gl.uniform4f(u.uOutlineColor, 0.05, 0.05, 0.05, 1.0);
        gl.uniform1f(u.uOutlineWidth, 0.0);
        gl.uniform1f(u.uEdgeSoftness, 0.0);
    });
}