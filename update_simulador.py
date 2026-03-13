import os
import json

file_path = "c:/Users/VICENT CARDONA/Documents/web-prof/js/simulador.js"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Variables
old1 = """// Estats d'interacció del Ratolí
let mouse = { x: 0, y: 0, down: false, rightDown: false };"""

new1 = """// Càmera i Historial
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let history = [];
let historyIndex = -1;
let clipboard = [];

// Estats d'interacció del Ratolí
let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false };"""

text = text.replace(old1, new1)

# 2. Add System Tools
old2 = """// --- Models de Dades OOP ---"""

new2 = """// --- Funcions de Càmera i Historial ---

function screenToWorld(sx, sy) {
    return {
        x: (sx - camera.x) / camera.zoom,
        y: (sy - camera.y) / camera.zoom
    };
}

function saveState() {
    if (historyIndex < history.length - 1) {
        history = history.slice(0, historyIndex + 1);
    }
    
    const snapshot = {
        nodes: nodes.map(n => ({
            id: n.id, type: n.type, x: n.x, y: n.y, text: n.text, active: n.active, width: n.width, height: n.height
        })),
        wires: wires.map(w => ({
            fromNodeId: w.fromPin.node.id, fromPinIndex: w.fromPin.index, fromPinType: w.fromPin.type,
            toNodeId: w.toPin.node.id, toPinIndex: w.toPin.index, toPinType: w.toPin.type
        }))
    };
    
    history.push(snapshot);
    if (history.length > 50) history.shift();
    else historyIndex++;
}

function loadState(snapshot) {
    if (!snapshot) return;
    
    let oldNodes = snapshot.nodes;
    nodes = oldNodes.map(n => {
        let node = new LogicNode(n.type, n.x, n.y);
        node.id = n.id;
        if (n.text !== undefined) node.text = n.text;
        if (n.active !== undefined) node.active = n.active;
        if (n.width !== undefined) node.width = n.width;
        if (n.height !== undefined) node.height = n.height;
        return node;
    });
    
    wires = [];
    snapshot.wires.forEach(wDef => {
        const fromNode = nodes.find(n => n.id === wDef.fromNodeId);
        const toNode = nodes.find(n => n.id === wDef.toNodeId);
        if (fromNode && toNode) {
            const fromPin = fromNode.pins.find(p => p.type === wDef.fromPinType && p.index === wDef.fromPinIndex) || fromNode.getOutPins()[0];
            const toPin = toNode.pins.find(p => p.type === wDef.toPinType && p.index === wDef.toPinIndex) || toNode.getInPins()[0];
            if (fromPin && toPin) wires.push(new Wire(fromPin, toPin));
        }
    });

    hoveringNode = null;
    hoveringPin = null;
    draggingNode = null;
    wiringFromPin = null;
}

function undo() {
    if (historyIndex > 0) {
        historyIndex--;
        loadState(history[historyIndex]);
    }
}

function redo() {
    if (historyIndex < history.length - 1) {
        historyIndex++;
        loadState(history[historyIndex]);
    }
}

// --- Models de Dades OOP ---"""

text = text.replace(old2, new2)

# 3. Drop logic and wheel
old3 = """// Canvas Drop
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        const rect = canvas.getBoundingClientRect();
        // Calculem les coordenades en l'escala interna del canvas
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        nodes.push(new LogicNode(type, x - 30, y - 30));
        
        // Amagar l'overlay tutorial quan s'afegeix un node
        const msg = document.getElementById('tutorial-msg');
        if (msg) msg.style.display = 'none';
    }
});"""

new3 = """// Canvas Drop
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    if (type) {
        const rect = canvas.getBoundingClientRect();
        const sx = e.clientX - rect.left;
        const sy = e.clientY - rect.top;
        const worldPos = screenToWorld(sx, sy);
        
        nodes.push(new LogicNode(type, worldPos.x - 30, worldPos.y - 30));
        saveState();
        
        const msg = document.getElementById('tutorial-msg');
        if (msg) msg.style.display = 'none';
    }
});

// Arrossegar fons (Càmera)
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    
    // On apunta el ratolí al món abans de l'escalat
    const worldBefore = screenToWorld(sx, sy);
    
    // Modificar zoom
    const zoomFactor = 1.1;
    if (e.deltaY < 0) camera.zoom *= zoomFactor;
    else camera.zoom /= zoomFactor;
    
    camera.zoom = Math.max(0.2, Math.min(camera.zoom, 3));
    
    camera.x = sx - worldBefore.x * camera.zoom;
    camera.y = sy - worldBefore.y * camera.zoom;
});"""

text = text.replace(old3, new3)

# 4. Mouse Move
old4 = """// Ratolí a dins del Canvas (Lògica Interna)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    
    // Si arrosseguem un node
    if (draggingNode && !wiringFromPin) {
        draggingNode.x = mouse.x - draggingNode.width/2;
        draggingNode.y = mouse.y - draggingNode.height/2;
        return;
    }

    // Comprovar hover sobre pins
    hoveringPin = null;
    let foundPin = false;
    // Donar prioritat a buscar pins primer
    for (let i = nodes.length - 1; i >= 0; i--) { // Busquem del més amunt al fons
        const node = nodes[i];
        for (let j = 0; j < node.pins.length; j++) {
            if (node.pins[j].isHovered(mouse.x, mouse.y)) {
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
            if (nodes[i].isHovered(mouse.x, mouse.y)) {
                hoveringNode = nodes[i];
                // Canviarem cursor a agafar només si mirem node sencer (i no pin)
                canvas.style.cursor = 'grab';
                return;
            }
        }
    }"""

new4 = """// Ratolí a dins del Canvas (Lògica Interna)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
    const worldPos = screenToWorld(mouse.x, mouse.y);
    mouse.worldX = worldPos.x;
    mouse.worldY = worldPos.y;
    
    if (isPanning) {
        camera.x += e.movementX;
        camera.y += e.movementY;
        return;
    }

    // Si arrosseguem un node
    if (draggingNode && !wiringFromPin) {
        draggingNode.x = mouse.worldX - draggingNode.width/2;
        draggingNode.y = mouse.worldY - draggingNode.height/2;
        return;
    }

    // Comprovar hover sobre pins
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
                canvas.style.cursor = 'grab';
                return;
            }
        }
    }"""

text = text.replace(old4, new4)

# 5. Mouse Down
old5 = """canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Click Esquerre
    
    // Si hem clicat un Pin, començar a cablejar"""

new5 = """canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Click Esquerre
    
    // Botó central o Shift+Esquerre per fer Pan
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
        isPanning = true;
        canvas.style.cursor = 'grabbing';
        return;
    }
    
    // Si hem clicat un Pin, començar a cablejar"""
text = text.replace(old5, new5)

# 6. SaveState on Delete right click
old6 = """// ** Click Dret per Esborrar Components / Cables **
    if (e.button === 2) {
        // Mirar si vull esborrar cable
        if (hoveringPin) {
            wires = wires.filter(w => w.fromPin !== hoveringPin && w.toPin !== hoveringPin);
            return;
        }
        // Mirar si vull esborrar node
        if (hoveringNode) {
            // Eliminar cables vinculats al node
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            // Eliminar node
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
        }
    }"""

new6 = """// ** Click Dret per Esborrar Components / Cables **
    if (e.button === 2) {
        // Mirar si vull esborrar cable
        if (hoveringPin) {
            wires = wires.filter(w => w.fromPin !== hoveringPin && w.toPin !== hoveringPin);
            saveState();
            return;
        }
        // Mirar si vull esborrar node
        if (hoveringNode) {
            // Eliminar cables vinculats al node
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            // Eliminar node
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
            saveState();
        }
    }"""
text = text.replace(old6, new6)

# 7. Mouse Up
old7 = """canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    draggingNode = null;
    
    // Deixar anar un cable sobre un altre Pin per finalitzar la connexió
    if (wiringFromPin && hoveringPin && wiringFromPin !== hoveringPin) {"""

new7 = """canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
    
    if (isPanning) {
        isPanning = false;
        canvas.style.cursor = 'default';
        return;
    }

    let stateChanged = false;
    if (draggingNode) stateChanged = true;
    draggingNode = null;
    
    // Deixar anar un cable sobre un altre Pin per finalitzar la connexió
    if (wiringFromPin && hoveringPin && wiringFromPin !== hoveringPin) {"""
text = text.replace(old7, new7)

# 8. SaveState on Wire push 
old8 = """wires = wires.filter(w => w.toPin !== inPin); // Treure cable antic que tingués
            wires.push(new Wire(outPin, inPin));
        }
    }
    
    wiringFromPin = null;
});"""
new8 = """wires = wires.filter(w => w.toPin !== inPin); // Treure cable antic que tingués
            wires.push(new Wire(outPin, inPin));
            stateChanged = true;
        }
    }
    
    wiringFromPin = null;
    if (stateChanged) saveState();
});"""
text = text.replace(old8, new8)

# 9. Keydown (Copy/Paste/Undo/Redo and Delete history)
old9 = """// Suprimir nodes via Teclat
window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hoveringNode) {
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
        }
    }
});"""
new9 = """// Suprimir nodes via Teclat i Undo/Redo/Copy/Paste
window.addEventListener('keydown', (e) => {
    // Esborrar
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hoveringNode && e.target === document.body) {
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
            saveState();
        }
    }
    
    // Undo / Redo
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'z') { e.preventDefault(); redo(); }
    
    // Copy / Cut / Paste
    if (e.ctrlKey && e.key.toLowerCase() === 'c') {
        if (hoveringNode) clipboard = [hoveringNode];
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'x') {
        if (hoveringNode) {
            clipboard = [hoveringNode];
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
            saveState();
        }
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'v') {
        if (clipboard.length > 0) {
            clipboard.forEach(cc => {
                let newNode = new LogicNode(cc.type, mouse.worldX, mouse.worldY);
                if (cc.text !== undefined) newNode.text = cc.text;
                if (cc.active !== undefined) newNode.active = cc.active;
                nodes.push(newNode);
            });
            saveState();
        }
    }
});"""
text = text.replace(old9, new9)

# 10. Clear circuit -> clean camera & history
old10 = """window.clearCircuit = function() {
    nodes = [];
    wires = [];
    const msg = document.getElementById('tutorial-msg');"""
new10 = """window.clearCircuit = function() {
    nodes = [];
    wires = [];
    camera = { x: 0, y: 0, zoom: 1 };
    saveState();
    const msg = document.getElementById('tutorial-msg');"""
text = text.replace(old10, new10)

# 11. Render camera Grid
old11 = """// 2. Render
    ctx.clearRect(0, 0, width, height);

    // Dibuixar Quadrícula
    ctx.lineWidth = 1;
    ctx.strokeStyle = style.bgGridFade;
    ctx.beginPath();
    for (let x = 0; x < width; x += style.gridLine) {
        ctx.moveTo(x, 0); ctx.lineTo(x, height);
    }
    for (let y = 0; y < height; y += style.gridLine) {
        ctx.moveTo(0, y); ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Dibuixar Tots els cables establerts"""
new11 = """// 2. Render
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    ctx.translate(camera.x, camera.y);
    ctx.scale(camera.zoom, camera.zoom);

    // Dibuixar Quadrícula (Adaptada al zoom/pan infinit)
    ctx.lineWidth = 1 / camera.zoom;
    ctx.strokeStyle = style.bgGridFade;
    ctx.beginPath();
    
    const startX = -camera.x / camera.zoom;
    const startY = -camera.y / camera.zoom;
    const endX = startX + width / camera.zoom;
    const endY = startY + height / camera.zoom;
    const step = style.gridLine;

    const firstGridX = Math.floor(startX / step) * step;
    const firstGridY = Math.floor(startY / step) * step;

    for (let x = firstGridX; x < endX; x += step) {
        ctx.moveTo(x, startY); ctx.lineTo(x, endY);
    }
    for (let y = firstGridY; y < endY; y += step) {
        ctx.moveTo(startX, y); ctx.lineTo(endX, y);
    }
    ctx.stroke();

    // Dibuixar Tots els cables establerts"""
text = text.replace(old11, new11)

# 12. Render wire draw
old12 = """if (wiringFromPin) {
        ctx.beginPath();
        const pos1 = wiringFromPin.getAbsolutePos();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(mouse.x, mouse.y);
        ctx.lineWidth = 4;
        ctx.strokeStyle = style.wireDrag;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // Dibuixar Tots els components (Portes lógiques)
    nodes.forEach(node => node.draw(ctx));

    requestAnimationFrame(loop);"""
new12 = """if (wiringFromPin) {
        ctx.beginPath();
        const pos1 = wiringFromPin.getAbsolutePos();
        ctx.moveTo(pos1.x, pos1.y);
        ctx.lineTo(mouse.worldX, mouse.worldY);
        ctx.lineWidth = 4;
        ctx.strokeStyle = style.wireDrag;
        ctx.lineCap = "round";
        ctx.stroke();
    }

    // Dibuixar Tots els components (Portes lógiques)
    nodes.forEach(node => node.draw(ctx));

    ctx.restore();
    requestAnimationFrame(loop);"""
text = text.replace(old12, new12)

# 13. Init history
old13 = """// Iniciar Motor
loop();"""
new13 = """// Iniciar Motor
saveState();
loop();"""
text = text.replace(old13, new13)

# 14. Fix saving state on dbl click text
oldDblClick = """hoveringNode.text = result;
            }
        } else if (hoveringNode.type === 'INPUT') {
            // Fixa de mode per si fa mandra clicar-lo molt en sistemes combinacionals complexos
            hoveringNode.active = !hoveringNode.active;
        }"""
newDblClick = """hoveringNode.text = result;
                saveState();
            }
        } else if (hoveringNode.type === 'INPUT') {
            // Fixa de mode per si fa mandra clicar-lo molt en sistemes combinacionals complexos
            hoveringNode.active = !hoveringNode.active;
            saveState();
        }"""
text = text.replace(oldDblClick, newDblClick)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done")
