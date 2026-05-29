export function compileShader(gl, type, src) {
    const sh = gl.createShader(type);
    gl.shaderSource(sh, src);
    gl.compileShader(sh);

    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(sh));
        console.error(src);
        throw new Error('Shader compile failed');
    }

    return sh;
}

export function makeProgram(gl, vsSrc, fsSrc, uniformNames) {
    const vs = compileShader(gl, gl.VERTEX_SHADER, vsSrc);
    const fs = compileShader(gl, gl.FRAGMENT_SHADER, fsSrc);

    const program = gl.createProgram();
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        throw new Error('Program link failed');
    }

    gl.deleteShader(vs);
    gl.deleteShader(fs);

    const uniforms = {};
    for (const name of uniformNames) {
        uniforms[name] = gl.getUniformLocation(program, name);
    }

    return { program, uniforms };
}

export function createFullscreenVAO(gl) {
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);

    // fullscreen triangle
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        3, -1,
        -1,  3,
    ]), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    gl.bindVertexArray(null);
    return { vao, vbo };
}

export function makeTexture(gl, w, h, internalFormat, format, type, linearFiltering) {
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);

    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linearFiltering ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linearFiltering ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        internalFormat,
        w,
        h,
        0,
        format,
        type,
        null
    );

    gl.bindTexture(gl.TEXTURE_2D, null);
    return tex;
}

export function makeTarget(gl, w, h, internalFormat, format, type, linearFiltering) {
    const texture = makeTexture(gl, w, h, internalFormat, format, type, linearFiltering);

    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

    const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
    if (status !== gl.FRAMEBUFFER_COMPLETE) {
        throw new Error('Framebuffer incomplete: ' + status.toString(16));
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { texture, fbo, width: w, height: h };
}

export function makePingPong(gl, w, h, internalFormat, format, type, linearFiltering) {
    const read = makeTarget(gl, w, h, internalFormat, format, type, linearFiltering);
    const write = makeTarget(gl, w, h, internalFormat, format, type, linearFiltering);

    return {
        read,
        write,
        swap() {
            const t = this.read;
            this.read = this.write;
            this.write = t;
        },
    };
}

export function clearTarget(gl, target) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
    gl.viewport(0, 0, target.width, target.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
}

export function draw(gl, vaoObj, programObj, target, setupFn) {
    gl.useProgram(programObj.program);
    gl.bindVertexArray(vaoObj.vao);

    if (target) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
        gl.viewport(0, 0, target.width, target.height);
    } else {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    }

    setupFn(programObj.uniforms);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.bindVertexArray(null);
}