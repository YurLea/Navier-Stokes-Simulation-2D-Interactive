export const VS = `#version 300 es
layout(location = 0) in vec2 aPos;
out vec2 vUv;

void main() {
  vUv = aPos * 0.5 + 0.5;
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

export const COMMON = `
uniform vec2 uResolution;
uniform float uObstacleEnabled;
uniform vec2 uObstacleCenterUV;
uniform float uObstacleRadiusUV;
uniform float uObstacleBoundaryUV;
uniform float uNoSlip;

ivec2 getOpenCoord(ivec2 coord) {
  return clamp(coord, ivec2(0, 0), ivec2(uResolution) - ivec2(1, 1));
}

vec2 cellUv(ivec2 cell) {
  return (vec2(cell) + vec2(0.5)) / uResolution;
}

float obstaclePhiUv(vec2 uv) {
  if (uObstacleEnabled < 0.5) return 1e9;
  return length(uv - uObstacleCenterUV) - uObstacleRadiusUV;
}

bool isSolidUv(vec2 uv) {
  return obstaclePhiUv(uv) < 0.0;
}

bool isSolidCell(ivec2 cell) {
  return isSolidUv(cellUv(cell));
}

vec2 ghostVelocityAxis(vec2 vCenter, ivec2 dir) {
  vec2 g = vCenter;

  if (dir.x != 0) {
    g.x = -vCenter.x;
    g.y = (uNoSlip > 0.5) ? -vCenter.y : vCenter.y;
  } else {
    g.y = -vCenter.y;
    g.x = (uNoSlip > 0.5) ? -vCenter.x : vCenter.x;
  }
  return g;
}

vec2 enforceCircleBC(vec2 uv, vec2 v) {
  if (uObstacleEnabled < 0.5) return v;

  vec2 d = uv - uObstacleCenterUV;
  float dist = length(d);
  float phi = dist - uObstacleRadiusUV;

  if (phi <= 0.0) return vec2(0.0);

  if (phi < uObstacleBoundaryUV) {
    vec2 n = d / max(dist, 1e-6);
    float t = clamp(phi / uObstacleBoundaryUV, 0.0, 1.0);

    float vn = dot(v, n);
    v -= n * vn * (1.0 - t);

    if (uNoSlip > 0.5)
      v *= t;
  }

  return v;
}
`;

export const ADVECT_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocityTex;
uniform sampler2D uFieldTex;

uniform float uDt;
uniform float uDissipation;
uniform float uIsVelocity;

${COMMON}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);
  vec2 uv = (vec2(pos) + vec2(0.5)) / uResolution;

  if (uObstacleEnabled > 0.5 && isSolidUv(uv)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 vel = texture(uVelocityTex, uv).xy;
  vec2 pastUv = uv - vel * uDt;

  if (uObstacleEnabled > 0.5) {
    vec2 to = pastUv - uObstacleCenterUV;
    float lenTo = length(to);
    if (lenTo < uObstacleRadiusUV) {
      vec2 dir = (lenTo > 1e-6) ? (to / lenTo) : vec2(1.0, 0.0);
      float texel = 1.0 / uResolution.x;
      pastUv = uObstacleCenterUV + dir * (uObstacleRadiusUV + texel);
    }
  }

  vec4 field = texture(uFieldTex, pastUv) * uDissipation;

  if (uIsVelocity > 0.5) {
    field.xy = enforceCircleBC(uv, field.xy);
  }

  outColor = field;
}
`;

export const DIVERGENCE_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocityTex;

${COMMON}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);

  if (isSolidCell(pos)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 uvC = cellUv(pos);
  vec2 vC = texture(uVelocityTex, uvC).xy;

  ivec2 L = getOpenCoord(pos + ivec2(-1, 0));
  ivec2 R = getOpenCoord(pos + ivec2( 1, 0));
  ivec2 B = getOpenCoord(pos + ivec2( 0,-1));
  ivec2 T = getOpenCoord(pos + ivec2( 0, 1));

  vec2 vL = isSolidCell(L) ? ghostVelocityAxis(vC, ivec2(-1, 0)) : texture(uVelocityTex, cellUv(L)).xy;
  vec2 vR = isSolidCell(R) ? ghostVelocityAxis(vC, ivec2( 1, 0)) : texture(uVelocityTex, cellUv(R)).xy;
  vec2 vB = isSolidCell(B) ? ghostVelocityAxis(vC, ivec2( 0,-1)) : texture(uVelocityTex, cellUv(B)).xy;
  vec2 vT = isSolidCell(T) ? ghostVelocityAxis(vC, ivec2( 0, 1)) : texture(uVelocityTex, cellUv(T)).xy;

  float scale = 0.5 * uResolution.x;
  float div = scale * ((vR.x - vL.x) + (vT.y - vB.y));

  outColor = vec4(div, 0.0, 0.0, 1.0);
}
`;

export const JACOBI_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uPressureTex;
uniform sampler2D uDivergenceTex;

uniform float uAlpha;
uniform float uRBeta;

${COMMON}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);

  if (isSolidCell(pos)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 uvC = cellUv(pos);
  float pC = texture(uPressureTex, uvC).r;

  ivec2 L = getOpenCoord(pos + ivec2(-1, 0));
  ivec2 R = getOpenCoord(pos + ivec2( 1, 0));
  ivec2 B = getOpenCoord(pos + ivec2( 0,-1));
  ivec2 T = getOpenCoord(pos + ivec2( 0, 1));

  float pL = isSolidCell(L) ? pC : texture(uPressureTex, cellUv(L)).r;
  float pR = isSolidCell(R) ? pC : texture(uPressureTex, cellUv(R)).r;
  float pB = isSolidCell(B) ? pC : texture(uPressureTex, cellUv(B)).r;
  float pT = isSolidCell(T) ? pC : texture(uPressureTex, cellUv(T)).r;

  float b = texture(uDivergenceTex, uvC).r;
  float p = (pL + pR + pB + pT + uAlpha * b) * uRBeta;

  outColor = vec4(p, 0.0, 0.0, 1.0);
}
`;

export const SUBTRACT_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uVelocityTex;
uniform sampler2D uPressureTex;

${COMMON}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);
  vec2 uv = (vec2(pos) + vec2(0.5)) / uResolution;

  if (isSolidCell(pos)) {
    outColor = vec4(0.0);
    return;
  }

  float pC = texture(uPressureTex, uv).r;

  ivec2 L = getOpenCoord(pos + ivec2(-1, 0));
  ivec2 R = getOpenCoord(pos + ivec2( 1, 0));
  ivec2 B = getOpenCoord(pos + ivec2( 0,-1));
  ivec2 T = getOpenCoord(pos + ivec2( 0, 1));

  float pL = isSolidCell(L) ? pC : texture(uPressureTex, cellUv(L)).r;
  float pR = isSolidCell(R) ? pC : texture(uPressureTex, cellUv(R)).r;
  float pB = isSolidCell(B) ? pC : texture(uPressureTex, cellUv(B)).r;
  float pT = isSolidCell(T) ? pC : texture(uPressureTex, cellUv(T)).r;

  float scale = 0.5 * uResolution.x;
  vec2 grad = vec2(pR - pL, pT - pB) * scale;

  vec2 v = texture(uVelocityTex, uv).xy - grad;
  v = enforceCircleBC(uv, v);

  outColor = vec4(v, 0.0, 1.0);
}
`;

export const SPLAT_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uSourceTex;

uniform vec2 uPoint;   // UV
uniform vec2 uForce;
uniform vec4 uColor;
uniform float uRadius; // UV^2
uniform float uIsVelocity;
uniform float uAspect;

${COMMON}

void main() {
  ivec2 pos = ivec2(gl_FragCoord.xy);
  vec2 uv = (vec2(pos) + vec2(0.5)) / uResolution;

  if (uObstacleEnabled > 0.5 && isSolidUv(uv)) {
    outColor = vec4(0.0);
    return;
  }

  vec2 p = uv - uPoint;
  p.x *= uAspect;

  float d = exp(-dot(p, p) / max(uRadius, 1e-6));

  vec4 field = texture(uSourceTex, uv);

  if (uIsVelocity > 0.5) {
    field.xy += uForce * d;
  } else {
    field += uColor * d;
  }

  outColor = field;
}
`;

export const COMPOSITE_FS = `#version 300 es
precision highp float;
precision highp sampler2D;

in vec2 vUv;
out vec4 outColor;

uniform sampler2D uMainTex;

uniform float uAspect;
uniform float uGradientRotation;

uniform float uObstacleEnabled;
uniform vec2 uObstacleCenterUV;
uniform float uObstacleRadiusUV;

uniform vec4 uColRed;
uniform vec4 uColGreen;
uniform vec4 uColBlue;

uniform vec4 uOutlineColor;
uniform float uOutlineWidth;
uniform float uEdgeSoftness;

vec2 rot(vec2 p, float a) {
  float s = sin(a), c = cos(a);
  return vec2(c * p.x - s * p.y, s * p.x + c * p.y);
}

vec3 bary(vec2 p, vec2 A, vec2 B, vec2 C) {
  vec2 v0 = B - A;
  vec2 v1 = C - A;
  vec2 v2 = p - A;
  float d00 = dot(v0, v0);
  float d01 = dot(v0, v1);
  float d11 = dot(v1, v1);
  float d20 = dot(v2, v0);
  float d21 = dot(v2, v1);
  float denom = d00 * d11 - d01 * d01;
  float v = (d11 * d20 - d01 * d21) / denom;
  float w = (d00 * d21 - d01 * d20) / denom;
  float u = 1.0 - v - w;
  return vec3(u, v, w);
}

void main() {
  vec4 col = texture(uMainTex, vUv);
  col.a = 1.0;

  if (uObstacleEnabled < 0.5) {
    outColor = col;
    return;
  }

  vec2 p = vUv - uObstacleCenterUV;
  p.x *= uAspect;

  float ang = uGradientRotation * 0.01745329252;
  p = rot(p, ang);

  vec2 q = p / max(uObstacleRadiusUV, 1e-6);
  float dist = length(q);
  float sdf = dist - 1.0;

  float aa = max(fwidth(dist), 1e-5) * 1.35 + uEdgeSoftness;
  float inside = 1.0 - smoothstep(0.0, aa, sdf);

  vec2 A = vec2(-0.8660254, -0.5);
  vec2 B = vec2( 0.8660254, -0.5);
  vec2 C = vec2( 0.0,         1.0);

  vec3 w = bary(q, A, B, C);
  w = max(w, 0.0);

  float s = w.x + w.y + w.z;
  w = (s > 1e-6) ? (w / s) : vec3(0.333, 0.333, 0.333);

  vec3 rgbFill = w.x * uColRed.rgb + w.z * uColGreen.rgb + w.y * uColBlue.rgb;

  col.rgb = mix(col.rgb, rgbFill, inside);

  float ring = 1.0 - smoothstep(uOutlineWidth, uOutlineWidth + aa, abs(sdf));
  col.rgb = mix(col.rgb, uOutlineColor.rgb, ring * uOutlineColor.a);

  outColor = col;
}
`;