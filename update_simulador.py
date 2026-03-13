import os
import json

file_path = "c:/Users/VICENT CARDONA/Documents/web-prof/js/simulador.js"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()


# 1. State for Tap-to-place logic on mobile
old1 = """// Càmera i Historial
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let history = [];
let historyIndex = -1;
let clipboard = [];

// Estats d'interacció del Ratolí
let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false };"""

new1 = """// Càmera i Historial
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let history = [];
let historyIndex = -1;
let clipboard = [];

// Estats d'interacció del Ratolí i Tàctil
let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false };
let mobileSelectedType = null; // Guardem tipus seleccionat via clic/tap en lloc d'arrossegar
let lastPinchCenter = null;
let lastPinchDist = null;"""

text = text.replace(old1, new1)

# 2. Bind sidebar clicks for Mobile "select-to-place"
old2 = """// Components a la Sidebar
const dragItems = document.querySelectorAll('.component-btn');
dragItems.forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
    });
});"""

new2 = """// Components a la Sidebar
const dragItems = document.querySelectorAll('.component-btn');
dragItems.forEach(item => {
    // Per PC:
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
    });
    // Per Mòbil/Tàctil (Tap-to-place):
    item.addEventListener('click', (e) => {
        // Deseleccionar previs
        dragItems.forEach(i => i.style.backgroundColor = "var(--bg-main)");
        
        if (mobileSelectedType === item.dataset.type) {
            mobileSelectedType = null; // Apagar si el torno a clicar
        } else {
            mobileSelectedType = item.dataset.type;
            item.style.backgroundColor = "#E0E7FF"; // Resaltar
        }
    });
});"""
text = text.replace(old2, new2)


# 3. Handle MouseDown AND TouchStart simultaneously
old3 = """canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Click Esquerre
    
    // Botó central o Shift+Esquerre per fer Pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
        return;
    }"""

new3 = """// --- ESDEVENIMENTS TÀCTILS (Mòbils i tauletes) ---

function getTouchWorldPos(touch) {
    const rect = canvas.getBoundingClientRect();
    const sx = touch.clientX - rect.left;
    const sy = touch.clientY - rect.top;
    return screenToWorld(sx, sy);
}

canvas.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
        // Equivalent a Mousedown esquerre
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        mouse.x = touch.clientX - rect.left;
        mouse.y = touch.clientY - rect.top;
        const wPos = screenToWorld(mouse.x, mouse.y);
        mouse.worldX = wPos.x;
        mouse.worldY = wPos.y;
        
        // Mode tap-to-place mòbil
        if (mobileSelectedType) {
            nodes.push(new LogicNode(mobileSelectedType, mouse.worldX - 30, mouse.worldY - 30));
            mobileSelectedType = null;
            dragItems.forEach(i => i.style.backgroundColor = "var(--bg-main)");
            saveState();
            
            // Si hem plantat ocultem missatge tutorial
            const msg = document.getElementById('tutorial-msg');
            if (msg) msg.style.display = 'none';
            return;
        }

        // Emular verificació de Hover abans d'iniciar arrossegaments/cables
        updateHovers();

        if (hoveringPin) {
            if (hoveringPin.type === 'in') {
                const connectXIdx = wires.findIndex(w => w.toPin === hoveringPin);
                if (connectXIdx !== -1) {
                    wiringFromPin = wires[connectXIdx].fromPin;
                    wires.splice(connectXIdx, 1);
                    return;
                }
            }
            wiringFromPin = hoveringPin;
            return;
        }

        if (hoveringNode) {
            draggingNode = hoveringNode;
            const idx = nodes.indexOf(draggingNode);
            nodes.splice(idx, 1);
            nodes.push(draggingNode);
        } else {
            // Pan Càmera per defecte amb un dit si toques el fons
            isPanning = true;
            canvas.style.cursor = 'grabbing';
            // Emulem movementX/Y manualment
            mouse.lastPanX = mouse.x;
            mouse.lastPanY = mouse.y;
        }
        
    } else if (e.touches.length === 2) {
        // Pinch-to-zoom setup
        isPanning = false; // abortem pan
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        lastPinchDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        // Punt mig
        const rect = canvas.getBoundingClientRect();
        const mx = ((t1.clientX + t2.clientX) / 2) - rect.left;
        const my = ((t1.clientY + t2.clientY) / 2) - rect.top;
        lastPinchCenter = {x: mx, y: my};
    }
}, {passive: false});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault(); // Evitar scroll del navegador!
    if (e.touches.length === 1) {
        const touch = e.touches[0];
        const rect = canvas.getBoundingClientRect();
        const curX = touch.clientX - rect.left;
        const curY = touch.clientY - rect.top;
        
        if (isPanning) {
            // Càlcul pan
            camera.x += (curX - mouse.lastPanX);
            camera.y += (curY - mouse.lastPanY);
            mouse.lastPanX = curX;
            mouse.lastPanY = curY;
            return;
        }
        
        mouse.x = curX; mouse.y = curY;
        const wPos = screenToWorld(mouse.x, mouse.y);
        mouse.worldX = wPos.x;
        mouse.worldY = wPos.y;

        if (draggingNode && !wiringFromPin) {
            draggingNode.x = mouse.worldX - draggingNode.width/2;
            draggingNode.y = mouse.worldY - draggingNode.height/2;
            return;
        }
        
        updateHovers();
        
    } else if (e.touches.length === 2) {
        // Pinch-to-zoom execute
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const currentDist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        
        if (lastPinchDist) {
            const worldBefore = screenToWorld(lastPinchCenter.x, lastPinchCenter.y);
            const factor = currentDist / lastPinchDist;
            camera.zoom *= factor;
            camera.zoom = Math.max(0.1, Math.min(camera.zoom, 5));
            camera.x = lastPinchCenter.x - worldBefore.x * camera.zoom;
            camera.y = lastPinchCenter.y - worldBefore.y * camera.zoom;
        }
        lastPinchDist = currentDist;
    }
}, {passive: false});

canvas.addEventListener('touchend', (e) => {
    if (e.touches.length === 0) {
        isPanning = false;
        lastPinchDist = null;
        lastPinchCenter = null;
        
        let stateChanged = false;
        if (draggingNode) stateChanged = true;
        draggingNode = null;
        
        if (wiringFromPin && hoveringPin && wiringFromPin !== hoveringPin) {
            let valid = true;
            let outPin = null; let inPin = null;
            if (wiringFromPin.type === 'out' && hoveringPin.type === 'in') {
                outPin = wiringFromPin; inPin = hoveringPin;
            } else if (wiringFromPin.type === 'in' && hoveringPin.type === 'out') {
                outPin = hoveringPin; inPin = wiringFromPin;
            } else valid = false;
            
            if (valid) {
                wires = wires.filter(w => w.toPin !== inPin);
                wires.push(new Wire(outPin, inPin));
                stateChanged = true;
            }
        }
        wiringFromPin = null;
        if (stateChanged) saveState();
    }
});

// Extraiem la lògica de Hover per ser cridada tant per Mouse com per Touch
function updateHovers() {
    hoveringPin = null;
    let foundPin = false;
    for (let i = nodes.length - 1; i >= 0; i--) {
        const node = nodes[i];
        for (let j = 0; j < node.pins.length; j++) {
            if (node.pins[j].isHovered(mouse.worldX, mouse.worldY)) {
                hoveringPin = node.pins[j];
                foundPin = true;
                break;
            }
        }
        if (foundPin) break;
    }

    hoveringNode = null;
    if (!foundPin && !wiringFromPin) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].isHovered(mouse.worldX, mouse.worldY)) {
                hoveringNode = nodes[i];
                return;
            }
        }
    }
}

// --- RATOLÍ (PC) ---

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Click Esquerre
    
    // Tap-to-place per PC en cas que facin click al menu lateral (opcional fallback)
    if (mobileSelectedType && e.button === 0) {
        nodes.push(new LogicNode(mobileSelectedType, mouse.worldX - 30, mouse.worldY - 30));
        mobileSelectedType = null;
        dragItems.forEach(i => i.style.backgroundColor = "var(--bg-main)");
        saveState();
        
        const msg = document.getElementById('tutorial-msg');
        if (msg) msg.style.display = 'none';
        return;
    }

    // Botó central o Shift+Esquerre per fer Pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
        return;
    }"""
text = text.replace(old3, new3)


# 4. Refactor mousemove hover
old4 = """// Comprovar hover sobre pins
    hoveringPin = null;
    let foundPin = false;
    for (let i = nodes.length - 1; i >= 0; i--) { // Busquem del més amunt al fons
        const node = nodes[i];
        for (let j = 0; j < node.pins.length; j++) {
            if (node.pins[j].isHovered(mouse.worldX, mouse.worldY)) {
                hoveringPin = node.pins[j];
                foundPin = true;
                break;
            }
        }
        if (foundPin) break;
    }

    // Comprovar hover sobre nodes
    hoveringNode = null;
    if (!foundPin && !wiringFromPin) {
        for (let i = nodes.length - 1; i >= 0; i--) {
            if (nodes[i].isHovered(mouse.worldX, mouse.worldY)) {
                hoveringNode = nodes[i];
                // Canviarem cursor a agafar només si mirem node sencer (i no pin)
                canvas.style.cursor = 'grab';
                return;
            }
        }
    }"""
new4 = """// Comprovar hover centralitzat
    updateHovers();
    if (hoveringNode && !wiringFromPin && !hoveringPin) {
        canvas.style.cursor = 'grab';
    }"""
text = text.replace(old4, new4)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done touch support injection")
