export function createPointerController(canvas) {
    const pointer = {
        down: false,
        x: 0,
        y: 0,
        prevX: 0,
        prevY: 0,
    };

    function eventToCanvasPixels(e) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (rect.bottom - e.clientY) * scaleY; // bottom-left origin
        return [x, y];
    }

    canvas.addEventListener('pointerdown', (e) => {
        canvas.setPointerCapture(e.pointerId);

        const [x, y] = eventToCanvasPixels(e);
        pointer.down = true;
        pointer.x = x;
        pointer.y = y;
        pointer.prevX = x;
        pointer.prevY = y;
    });

    canvas.addEventListener('pointermove', (e) => {
        const [x, y] = eventToCanvasPixels(e);
        pointer.x = x;
        pointer.y = y;
    });

    canvas.addEventListener('pointerup', () => {
        pointer.down = false;
    });

    canvas.addEventListener('pointercancel', () => {
        pointer.down = false;
    });

    canvas.addEventListener('pointerleave', () => {
        // можно оставить как есть
    });

    return pointer;
}