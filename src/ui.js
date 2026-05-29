export function getUI() {
    return {
        resolution: document.getElementById('resolution'),
        iterations: document.getElementById('iterations'),
        dt: document.getElementById('dt'),
        velDiss: document.getElementById('velDiss'),
        dyeDiss: document.getElementById('dyeDiss'),
        splatRadius: document.getElementById('splatRadius'),
        forceMultiplier: document.getElementById('forceMultiplier'),
        obstacleEnabled: document.getElementById('obstacleEnabled'),
        obsX: document.getElementById('obsX'),
        obsY: document.getElementById('obsY'),
        obsR: document.getElementById('obsR'),
        noSlip: document.getElementById('noSlip'),
        gradientRotation: document.getElementById('gradientRotation'),
        reset: document.getElementById('reset'),

        resVal: document.getElementById('resVal'),
        itersVal: document.getElementById('itersVal'),
        dtVal: document.getElementById('dtVal'),
        velDisVal: document.getElementById('velDisVal'),
        dyeDisVal: document.getElementById('dyeDisVal'),
        radiusVal: document.getElementById('radiusVal'),
        forceVal: document.getElementById('forceVal'),
        obsXVal: document.getElementById('obsXVal'),
        obsYVal: document.getElementById('obsYVal'),
        obsRVal: document.getElementById('obsRVal'),
        rotVal: document.getElementById('rotVal'),
    };
}

export function syncUI(state, ui) {
    ui.resVal.textContent = state.resolution;
    ui.itersVal.textContent = state.iterations;
    ui.dtVal.textContent = state.dt.toFixed(3);
    ui.velDisVal.textContent = state.velocityDissipation.toFixed(4);
    ui.dyeDisVal.textContent = state.dyeDissipation.toFixed(4);
    ui.radiusVal.textContent = state.splatRadius.toFixed(3);
    ui.forceVal.textContent = Math.round(state.forceMultiplier);
    ui.obsXVal.textContent = state.obstacleCenter01[0].toFixed(2);
    ui.obsYVal.textContent = state.obstacleCenter01[1].toFixed(2);
    ui.obsRVal.textContent = state.obstacleRadius01.toFixed(2);
    ui.rotVal.textContent = Math.round(state.gradientRotation);
}

export function readUIIntoState(state, ui) {
    state.resolution = parseInt(ui.resolution.value, 10);
    state.iterations = parseInt(ui.iterations.value, 10);
    state.dt = parseFloat(ui.dt.value);
    state.velocityDissipation = parseFloat(ui.velDiss.value);
    state.dyeDissipation = parseFloat(ui.dyeDiss.value);
    state.splatRadius = parseFloat(ui.splatRadius.value);
    state.forceMultiplier = parseFloat(ui.forceMultiplier.value);
    state.obstacleEnabled = ui.obstacleEnabled.checked;
    state.obstacleCenter01[0] = parseFloat(ui.obsX.value);
    state.obstacleCenter01[1] = parseFloat(ui.obsY.value);
    state.obstacleRadius01 = parseFloat(ui.obsR.value);
    state.noSlip = ui.noSlip.checked;
    state.gradientRotation = parseFloat(ui.gradientRotation.value);

    syncUI(state, ui);
}

export function bindUI({ state, ui, onResolutionChange, onReset }) {
    // initial read from DOM
    readUIIntoState(state, ui);

    const read = () => readUIIntoState(state, ui);

    ui.resolution.addEventListener('input', () => {
        const prev = state.resolution;
        read();
        if (state.resolution !== prev && onResolutionChange) onResolutionChange();
    });

    ui.iterations.addEventListener('input', read);
    ui.dt.addEventListener('input', read);
    ui.velDiss.addEventListener('input', read);
    ui.dyeDiss.addEventListener('input', read);
    ui.splatRadius.addEventListener('input', read);
    ui.forceMultiplier.addEventListener('input', read);
    ui.obstacleEnabled.addEventListener('input', read);
    ui.obsX.addEventListener('input', read);
    ui.obsY.addEventListener('input', read);
    ui.obsR.addEventListener('input', read);
    ui.noSlip.addEventListener('input', read);
    ui.gradientRotation.addEventListener('input', read);

    ui.reset.addEventListener('click', () => {
        if (onReset) onReset();
    });
}