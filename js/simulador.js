/**
 * Motor de Simulació de Circuits Lògics (HTML5 Canvas + Vanilla JS)
 * Enginyeria pura renderitzada a 60 FPS
 */

// --- Variables Globals ---
const canvas = document.getElementById('circuit-canvas');
const ctx = canvas.getContext('2d');
let width = 0;
let height = 0;

// Llistes de simulació
let nodes = []; // Tots els components (Portes, Inputs, Outputs)
let wires = []; // Tots els cables

// Càmera i Historial
let camera = { x: 0, y: 0, zoom: 1 };
let isPanning = false;
let history = [];
let historyIndex = -1;
let clipboard = [];

// Estats d'interacció del Ratolí i Tàctil
let mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false, rightDown: false };
let mobileSelectedType = null; // Guardem tipus seleccionat via clic/tap en lloc d'arrossegar
let lastPinchCenter = null;
let lastPinchDist = null;
let draggingNode = null;
let hoveringNode = null;
let hoveringPin = null; 
let wiringFromPin = null; // Quan estem "estirant" un cable

// Ajust del Canvas a finestra plena
function resizeCanvas() {
    const rect = canvas.parentElement.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    // High-DPI support per pantalles nítides
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// --- Colors i Estils del Simulador ---
const style = {
    bgGridFade: "rgba(100, 116, 139, 0.1)", // Gris fons quadrícula
    gridLine: 20,
    nodeBg: "#FFFFFF",
    nodeBorder: "#475569", // Slate 600
    textColor: "#1E293B",
    pinBg: "#E2E8F0",
    pinBorder: "#475569",
    wireOff: "#94A3B8", // Gris
    wireOn: "#EF4444",  // Vermell electricitat
    wireDrag: "rgba(59, 130, 246, 0.5)", // Blau cable penjant
    activeInput: "#10B981" // Verd per quan polsem un interruptor
};

// --- Funcions de Càmera i Historial ---

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

// --- Models de Dades OOP ---

class Pin {
    constructor(node, xOffset, yOffset, type, index) {
        this.node = node;
        this.xOffset = xOffset;
        this.yOffset = yOffset;
        this.type = type; // 'in' o 'out'
        this.index = index; // quin pin d'entrada és (0, 1)
        this.value = 0; // Estat elèctric (0 o 1)
        this.radius = 6;
    }

    getAbsolutePos() {
        return {
            x: this.node.x + this.xOffset,
            y: this.node.y + this.yOffset
        };
    }

    isHovered(worldX, worldY) {
        const pos = this.getAbsolutePos();
        const dx = worldX - pos.x;
        const dy = worldY - pos.y;
        return (dx * dx + dy * dy) < (this.radius * 2.5) * (this.radius * 2.5); // Area generosa de clic
    }
}

class LogicNode {
    constructor(type, x, y) {
        this.id = Math.random().toString(36).substr(2, 9);
        this.type = type; // 'AND', 'OR', 'INPUT', 'TEXT', 'WAYPOINT', etc.
        this.x = x;
        this.y = y;
        
        // Mides variables segons el tipus
        if (this.type === 'WAYPOINT') {
            this.width = 16;
            this.height = 16;
        } else if (this.type === 'TEXT') {
            this.width = 100;
            this.height = 30;
            this.text = "Etiqueta text..."; // Text per defecte
        } else {
            this.width = 60;
            this.height = 60;
        }
        
        this.pins = [];
        this.setupPins();
        
        this.active = false; // per a INPUTS (Switch ON/OFF)
        this.outputValue = 0; 
    }

    setupPins() {
        if (this.type === 'TEXT') {
            // Els textos no tenen pins elèctrics
            return;
        } else if (this.type === 'WAYPOINT') {
            // Pin in i pin out superposats al mig
            this.pins.push(new Pin(this, this.width/2 - 6, this.height/2, 'in', 0));
            this.pins.push(new Pin(this, this.width/2 + 6, this.height/2, 'out', 0));
        } else if (this.type === 'INPUT' || this.type === 'CLOCK') {
            this.pins.push(new Pin(this, this.width, this.height/2, 'out', 0));
        } else if (this.type === 'OUTPUT') {
            this.pins.push(new Pin(this, 0, this.height/2, 'in', 0));
        } else if (this.type === 'NOT') {
            this.pins.push(new Pin(this, 0, this.height/2, 'in', 0));
            this.pins.push(new Pin(this, this.width, this.height/2, 'out', 0));
        } else {
            // AND, OR, NAND, NOR, XOR tenen 2 entrades generals
            this.pins.push(new Pin(this, 0, this.height/4, 'in', 0));
            this.pins.push(new Pin(this, 0, this.height*0.75, 'in', 1));
            this.pins.push(new Pin(this, this.width, this.height/2, 'out', 0));
        }
    }

    getInPins() { return this.pins.filter(p => p.type === 'in'); }
    getOutPins() { return this.pins.filter(p => p.type === 'out'); }

    // El cervell matemàtic del node
    evaluate() {
        // Recullir valors d'entrada connectats a aquests pins mitjançant Wires
        const inPins = this.getInPins();
        // Netejar valors d'entrada primer (per defecte 0)
        inPins.forEach(p => p.value = 0);
        
        // Cerca cables que connecten cap als meus pins d'entrada
        wires.forEach(w => {
            if (w.toPin && w.toPin.node === this) {
                w.toPin.value = w.fromPin.value; // Propaga electricitat
            }
        });

        // Computar funció
        let a = inPins.length > 0 ? inPins[0].value : 0;
        let b = inPins.length > 1 ? inPins[1].value : 0;

        switch(this.type) {
            case 'INPUT':
                this.outputValue = this.active ? 1 : 0;
                break;
            case 'CLOCK':
                // Clocks alternen cada cert temps en el loop
                const time = Date.now();
                this.outputValue = Math.floor(time / 500) % 2; // Oscil·la cada mig segon
                break;
            case 'AND':
                this.outputValue = (a && b) ? 1 : 0;
                break;
            case 'OR':
                this.outputValue = (a || b) ? 1 : 0;
                break;
            case 'NOT':
                this.outputValue = (!a) ? 1 : 0;
                break;
            case 'NAND':
                this.outputValue = !(a && b) ? 1 : 0;
                break;
            case 'NOR':
                this.outputValue = !(a || b) ? 1 : 0;
                break;
            case 'XOR':
                this.outputValue = (a !== b) ? 1 : 0;
                break;
            case 'OUTPUT':
                this.outputValue = a; // Simplement reflectir l'entrada per pintar el LED
                break;
            case 'WAYPOINT':
                this.outputValue = a; // L'ancoratge simplement traspassa el senyal elèctric idèntic
                break;
            case 'TEXT':
                // No cal calcular res per als textos
                break;
        }

        // Actualitzar valor dels meus pins de sortida
        this.getOutPins().forEach(p => p.value = this.outputValue);
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);

        // Caixa Base
        ctx.fillStyle = style.nodeBg;
        ctx.strokeStyle = style.nodeBorder;
        ctx.lineWidth = 2;
        
        if (this === hoveringNode) {
            ctx.shadowColor = 'rgba(59, 130, 246, 0.4)';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#3B82F6';
        }

        ctx.beginPath();
        // Forma específica segons tipus
        if (this.type === 'INPUT' || this.type === 'CLOCK') {
            // Forma rodona
            ctx.arc(this.width/2, this.height/2, this.width/2.5, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            // Mostrar si està encès
            if (this.outputValue === 1) {
                ctx.fillStyle = style.activeInput;
                ctx.fill();
            }
        } else if (this.type === 'OUTPUT') {
            // Bombeta
            ctx.arc(this.width/2, this.height/2, this.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
            if (this.outputValue === 1) {
                ctx.fillStyle = "#FCD34D"; // Groc llum LED encès
                ctx.fill();
                ctx.shadowColor = '#FBBF24';
                ctx.shadowBlur = 20;
            } else {
                ctx.fillStyle = "#E2E8F0";
                ctx.fill();
            }
        } else if (this.type === 'WAYPOINT') {
            // Un punt petit i fi
            ctx.fillStyle = (this.outputValue === 1) ? style.wireOn : style.wireOff;
            ctx.strokeStyle = style.nodeBorder;
            ctx.lineWidth = 1;
            ctx.arc(this.width/2, this.height/2, this.width/2, 0, Math.PI*2);
            ctx.fill();
            ctx.stroke();
        } else if (this.type === 'TEXT') {
            // Node transparent només amb text
            ctx.fillStyle = "transparent";
            ctx.strokeStyle = "transparent";
            ctx.roundRect(0, 0, this.width, this.height, 4);
            ctx.fill();
            ctx.stroke(); // Clicable transparent

            // Calcular amplada real per ajustar la capsa màgica de hover
            ctx.font = "bold 16px Inter";
            const textMetrics = ctx.measureText(this.text);
            this.width = Math.max(80, textMetrics.width + 20); // expandir la capsa per si el text és llarg

            // Fons subtil grogós si està seleccionat, per fer-ho notar
            if (this === hoveringNode) {
                ctx.fillStyle = "rgba(252, 211, 77, 0.2)";
                ctx.fillRect(0, 0, this.width, this.height);
            }

            ctx.fillStyle = "#475569"; // Color de text general a la UI
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(this.text, this.width/2, this.height/2);

        } else {
            // Caixa quadrada estàndard per totes les portes de moment
            // per a simplificar dibuix inicial, utilitzarem símbols dins
            ctx.roundRect(0, 0, this.width, this.height, 8);
            ctx.fill();
            ctx.stroke();
            
            // Text al mig
            ctx.fillStyle = style.textColor;
            ctx.font = "bold 16px Inter";
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.shadowBlur = 0;
            let symbol = this.type;
            if (this.type === 'AND') symbol = '&';
            if (this.type === 'OR') symbol = '≥1';
            if (this.type === 'NOT') symbol = '1';
            if (this.type === 'NAND') symbol = '&○';
            if (this.type === 'NOR') symbol = '≥1○';
            if (this.type === 'XOR') symbol = '=1';
            ctx.fillText(symbol, this.width/2, this.height/2);
            ctx.font = "10px Inter";
            ctx.fillText(this.type, this.width/2, this.height/2 + 20);
        }

        ctx.restore();

        // Dibuixar Pins (En coordenades absolutes)
        ctx.shadowBlur = 0;
        this.pins.forEach(p => {
            const pos = p.getAbsolutePos();
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, p.radius, 0, Math.PI*2);
            
            // Si estem fent hover rellisca una aura
            if (p === hoveringPin) {
                ctx.fillStyle = "#3B82F6";
                ctx.strokeStyle = "#1E3A8A";
                ctx.lineWidth = 2;
            } else {
                ctx.fillStyle = (p.value === 1) ? style.wireOn : style.pinBg;
                ctx.strokeStyle = style.pinBorder;
                ctx.lineWidth = 1.5;
            }
            ctx.fill();
            ctx.stroke();
        });
    }

    isHovered(worldX, worldY) {
        // Retorna true si el ratolí està dins la seva àrea principal (en coordenades mon)
        return (worldX >= this.x && worldX <= this.x + this.width &&
                worldY >= this.y && worldY <= this.y + this.height);
    }
}

class Wire {
    constructor(fromPin, toPin) {
        this.fromPin = fromPin;
        this.toPin = toPin;
    }

    draw(ctx) {
        if (!this.fromPin || !this.toPin) return;
        
        const pos1 = this.fromPin.getAbsolutePos();
        const pos2 = this.toPin.getAbsolutePos();
        
        ctx.beginPath();
        // Corba Bezier per fer cables suaus
        ctx.moveTo(pos1.x, pos1.y);
        // Punts de control per donar efecte de cable "pla" que surt recte
        const cpDist = Math.max(Math.abs(pos2.x - pos1.x) / 2, 30);
        ctx.bezierCurveTo(
            pos1.x + cpDist, pos1.y,
            pos2.x - cpDist, pos2.y,
            pos2.x, pos2.y
        );
        
        ctx.lineWidth = 4;
        ctx.strokeStyle = (this.fromPin.value === 1) ? style.wireOn : style.wireOff;
        ctx.lineCap = "round";
        ctx.stroke();
    }
}

// --- Integració DOM i Event Listeners (Drag & Drop natiu -> Canvas) ---

// Components a la Sidebar
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
});

// Canvas Drop
canvas.addEventListener('dragover', (e) => {
    e.preventDefault(); // Permet el drop
});

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
    
    camera.zoom = Math.max(0.1, Math.min(camera.zoom, 5));
    
    // Reajustar desplaçament perquè el punt del món estigui on apuntava el ratolí
    camera.x = sx - worldBefore.x * camera.zoom;
    camera.y = sy - worldBefore.y * camera.zoom;
});

// Ratolí a dins del Canvas (Lògica Interna)
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

    // Comprovar hover centralitzat
    updateHovers();
    if (hoveringNode && !wiringFromPin && !hoveringPin) {
        canvas.style.cursor = 'grab';
    }
    
    if (hoveringPin || wiringFromPin) {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
});

// --- ESDEVENIMENTS TÀCTILS (Mòbils i tauletes) ---

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
    }
    
    // Si hem clicat un Pin, començar a cablejar
    if (hoveringPin && e.button === 0) {
        // Si el pin ja té connexió com a ENTRADA, desfem la connexió prèvia
        if (hoveringPin.type === 'in') {
            const connectXIdx = wires.findIndex(w => w.toPin === hoveringPin);
            if (connectXIdx !== -1) {
                // Recuperem el cable per tirar-lo endarrere
                wiringFromPin = wires[connectXIdx].fromPin;
                wires.splice(connectXIdx, 1);
                return; // el save state el farem al deixar anar
            }
        }
        wiringFromPin = hoveringPin;
        return;
    }
    
    // Si hem clicat un Node (i és CLICK, per invertir interruptors)
    if (hoveringNode && e.button === 0) {
        // Només els blocs INPUT sense clock poden fer toggle de polsador 0 i 1
        if (hoveringNode.type === 'INPUT') {
            hoveringNode.active = !hoveringNode.active;
            saveState();
        }
    }

    // Si hem clicat un Node fons, l'arrosseguem
    if (hoveringNode && e.button === 0 && !hoveringPin) {
        draggingNode = hoveringNode;
        // Posar al final de l'array per pintar per sobre
        const idx = nodes.indexOf(draggingNode);
        nodes.splice(idx, 1);
        nodes.push(draggingNode);
    }
    
    // ** Click Dret per Esborrar Components / Cables **
    if (e.button === 2) {
        if (hoveringPin) {
            wires = wires.filter(w => w.fromPin !== hoveringPin && w.toPin !== hoveringPin);
            saveState();
            return;
        }
        if (hoveringNode) {
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
            saveState();
        }
    }
});

// --- EDITOR DE TEXT INLINE ---
const inlineEditor = document.getElementById('inline-text-editor');
let editingNode = null;

function closeInlineEditor() {
    if (!editingNode) return;
    if (inlineEditor.style.display !== 'none') {
        editingNode.text = inlineEditor.value;
        inlineEditor.style.display = 'none';
        editingNode = null;
        saveState();
    }
}

inlineEditor.addEventListener('blur', closeInlineEditor);
inlineEditor.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        closeInlineEditor();
        canvas.focus(); // Retornar el focus al canvas
    }
});

// Doble Clic per interaccions riques (Text o Interruptors fixos)
canvas.addEventListener('dblclick', (e) => {
    if (hoveringNode) {
        if (hoveringNode.type === 'TEXT') {
            editingNode = hoveringNode;
            
            // Transformar coordenades Món -> Pantalla
            const screenX = hoveringNode.x * camera.zoom + camera.x;
            const screenY = hoveringNode.y * camera.zoom + camera.y;
            
            inlineEditor.value = hoveringNode.text !== "Etiqueta text..." ? hoveringNode.text : "";
            inlineEditor.style.display = 'block';
            inlineEditor.style.left = `${screenX}px`;
            inlineEditor.style.top = `${screenY}px`;
            
            // Escalar la capsa segons el zoom i alçada del node
            inlineEditor.style.width = `${Math.max(100, hoveringNode.width * camera.zoom)}px`;
            inlineEditor.style.height = `${hoveringNode.height * camera.zoom}px`;
            inlineEditor.style.fontSize = `${16 * camera.zoom}px`;
            
            inlineEditor.focus();
            inlineEditor.select();
        } else if (hoveringNode.type === 'INPUT') {
            hoveringNode.active = !hoveringNode.active;
            saveState();
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
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
    if (wiringFromPin && hoveringPin && wiringFromPin !== hoveringPin) {
        // Lògica de seguretat: Validar que un és 'out' i l'altre 'in'
        let valid = true;
        let outPin = null;
        let inPin = null;
        
        if (wiringFromPin.type === 'out' && hoveringPin.type === 'in') {
            outPin = wiringFromPin; inPin = hoveringPin;
        } else if (wiringFromPin.type === 'in' && hoveringPin.type === 'out') {
            outPin = hoveringPin; inPin = wiringFromPin;
        } else {
            valid = false; // dos sortides connectades, o dos entrades
        }
        
        // Evitar que una entrada rebi múltiples línies alhora
        if (valid) {
            wires = wires.filter(w => w.toPin !== inPin); // Treure cable antic que tingués
            wires.push(new Wire(outPin, inPin));
            stateChanged = true;
        }
    }
    
    wiringFromPin = null;
    if (stateChanged) saveState();
});

// Evitar menú de context del navegador al fer click dret al canvas
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Suprimir nodes via Teclat i Undo/Redo/Copy/Paste
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
});

// Netejar Taulell
window.clearCircuit = function() {
    nodes = [];
    wires = [];
    camera = { x: 0, y: 0, zoom: 1 };
    saveState();
    const msg = document.getElementById('tutorial-msg');
    if (msg) msg.style.display = 'block';
};

// --- Bucle d'Animació i Simulació (Motor) ---

function loop() {
    // 1. Math Update
    for(let pass = 0; pass < 3; pass++) {
        nodes.forEach(node => node.evaluate());
    }

    // 2. Render
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

    // Dibuixar Tots els cables establerts
    wires.forEach(w => w.draw(ctx));

    // Dibuixar el cable interactiu creant-se ara mateix
    if (wiringFromPin) {
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
    requestAnimationFrame(loop);
}

// Iniciar Motor
saveState();
loop();


// --- CIRCUITS D'EXEMPLE ---

window.loadExample = function(level) {
    clearCircuit();
    
    // Helpers
    function addText(t, x, y) { let n = new LogicNode('TEXT', x, y); n.text = t; nodes.push(n); return n; }
    function addNode(type, x, y) { let n = new LogicNode(type, x, y); nodes.push(n); return n; }
    function connect(n1, outIndex, n2, inIndex) {
        let p1 = n1.getOutPins()[outIndex];
        let p2 = n2.getInPins()[inIndex];
        if(p1 && p2) wires.push(new Wire(p1, p2));
    }
    
    if (level === 1) { // Lògica Combinacional Simple
        let a = addNode('INPUT', 100, 150); addText('A', 100, 120);
        let b = addNode('INPUT', 100, 250); addText('B', 100, 220);
        let and = addNode('AND', 300, 200);
        let not = addNode('NOT', 500, 200);
        let out = addNode('OUTPUT', 700, 200); addText('NAND Feta a mà', 700, 170);
        
        connect(a, 0, and, 0);
        connect(b, 0, and, 1);
        connect(and, 0, not, 0);
        connect(not, 0, out, 0);
    }
    else if (level === 2) { // Porta XOR (Manual)
        let a = addNode('INPUT', 100, 150); addText('A (X)', 100, 120);
        let b = addNode('INPUT', 100, 350); addText('B (Y)', 100, 320);
        
        let notA = addNode('NOT', 250, 100); addText("A Negada", 250, 70);
        let notB = addNode('NOT', 250, 400); addText("B Negada", 250, 370);
        
        let and1 = addNode('AND', 450, 150); addText("A' * B", 450, 120);
        let and2 = addNode('AND', 450, 300); addText("A * B'", 450, 270);
        
        let or = addNode('OR', 650, 225); addText("Suma Lògica", 650, 195);
        let out = addNode('OUTPUT', 850, 225); addText('A XOR B', 850, 195);
        
        connect(a, 0, notA, 0);
        connect(b, 0, notB, 0);
        
        connect(notA, 0, and1, 0); // A'
        connect(b, 0, and1, 1);    // B
        
        connect(a, 0, and2, 0);    // A
        connect(notB, 0, and2, 1); // B'
        
        connect(and1, 0, or, 0);
        connect(and2, 0, or, 1);
        connect(or, 0, out, 0);
    }
    else if (level === 3) { // Semi-Sumador (Half Adder)
        let a = addNode('INPUT', 100, 200); addText('Bit A', 100, 170);
        let b = addNode('INPUT', 100, 350); addText('Bit B', 100, 320);
        
        let xor = addNode('XOR', 350, 200);
        let and = addNode('AND', 350, 350);
        
        let sum = addNode('OUTPUT', 600, 200); addText('Bit de Suma (S)', 600, 170);
        let carry = addNode('OUTPUT', 600, 350); addText('Acarreig (Carry)', 600, 320);
        
        connect(a, 0, xor, 0);
        connect(b, 0, xor, 1);
        
        connect(a, 0, and, 0);
        connect(b, 0, and, 1);
        
        connect(xor, 0, sum, 0);
        connect(and, 0, carry, 0);
    }
    else if (level === 4) { // Sumador Complet (Full Adder)
        camera.zoom = 0.8; 
        camera.x = 50; camera.y = 50;
        
        let a = addNode('INPUT', 100, 150); addText('A (Bit 0)', 100, 120);
        let b = addNode('INPUT', 100, 250); addText('B (Bit 1)', 100, 220);
        let cin = addNode('INPUT', 100, 400); addText('Carry IN', 100, 370);
        
        let xor1 = addNode('XOR', 350, 200);
        let and1 = addNode('AND', 350, 300);
        
        connect(a, 0, xor1, 0); connect(b, 0, xor1, 1);
        connect(a, 0, and1, 0); connect(b, 0, and1, 1);
        
        let xor2 = addNode('XOR', 600, 275);
        let and2 = addNode('AND', 600, 425);
        
        connect(xor1, 0, xor2, 0); connect(cin, 0, xor2, 1);
        connect(xor1, 0, and2, 0); connect(cin, 0, and2, 1);
        
        let or = addNode('OR', 800, 360);
        connect(and2, 0, or, 0); connect(and1, 0, or, 1);
        
        let sum = addNode('OUTPUT', 950, 275); addText('SUMA FINAL', 950, 245);
        let cout = addNode('OUTPUT', 950, 360); addText('CARRY OUT (Acarreig)', 950, 330);
        
        connect(xor2, 0, sum, 0);
        connect(or, 0, cout, 0);
    }
    else if (level === 5) { // Sumador 4-bits
        // Fem zoom out molt gran perquè és enorme
        camera.zoom = 0.35;
        camera.x = 100; camera.y = 100;
        
        // Funció Helper per crear un Full Adder encapsulat
        // Retorna objecte amb referències als nodes interns
        function createFullAdder(xOff, yOff, nameSuffix) {
            let xor1 = addNode('XOR', xOff + 200, yOff + 50);
            let and1 = addNode('AND', xOff + 200, yOff + 150);
            
            let xor2 = addNode('XOR', xOff + 400, yOff + 100);
            let and2 = addNode('AND', xOff + 400, yOff + 250);
            
            let or = addNode('OR', xOff + 600, yOff + 200);
            
            connect(xor1, 0, xor2, 0);
            connect(xor1, 0, and2, 0);
            
            connect(and2, 0, or, 0);
            connect(and1, 0, or, 1);
            
            addText('FA ' + nameSuffix, xOff + 400, yOff);
            
            return {
                xor1_A: { node: xor1, pin: 0 },
                xor1_B: { node: xor1, pin: 1 },
                and1_A: { node: and1, pin: 0 },
                and1_B: { node: and1, pin: 1 },
                xor2_Cin: { node: xor2, pin: 1 },
                and2_Cin: { node: and2, pin: 1 },
                sumOut: { node: xor2, pin: 0 },
                coutOut: { node: or, pin: 0 }
            };
        }
        
        let yStep = 450;
        
        // Entrades A (4 bits)
        let a0 = addNode('INPUT', 150, 100); addText('A0 (Bit 0)', 150, 70);
        let a1 = addNode('INPUT', 150, 100 + yStep); addText('A1 (Bit 1)', 150, 70 + yStep);
        let a2 = addNode('INPUT', 150, 100 + yStep*2); addText('A2 (Bit 2)', 150, 70 + yStep*2);
        let a3 = addNode('INPUT', 150, 100 + yStep*3); addText('A3 (Bit 3)', 150, 70 + yStep*3);
        
        // Entrades B (4 bits)
        let b0 = addNode('INPUT', 150, 200); addText('B0 (Bit 0)', 150, 170);
        let b1 = addNode('INPUT', 150, 200 + yStep); addText('B1 (Bit 1)', 150, 170 + yStep);
        let b2 = addNode('INPUT', 150, 200 + yStep*2); addText('B2 (Bit 2)', 150, 170 + yStep*2);
        let b3 = addNode('INPUT', 150, 200 + yStep*3); addText('B3 (Bit 3)', 150, 170 + yStep*3);
        
        // Entrada Carry Inicial
        let cin0 = addNode('INPUT', 150, 350); addText('Carry In', 150, 320);
        
        // Sortides Suma (4 bits) i Carry Final
        let s0 = addNode('OUTPUT', 1200, 150); addText('SUM 0', 1200, 120);
        let s1 = addNode('OUTPUT', 1200, 150 + yStep); addText('SUM 1', 1200, 120 + yStep);
        let s2 = addNode('OUTPUT', 1200, 150 + yStep*2); addText('SUM 2', 1200, 120 + yStep*2);
        let s3 = addNode('OUTPUT', 1200, 150 + yStep*3); addText('SUM 3', 1200, 120 + yStep*3);
        let coutFinal = addNode('OUTPUT', 1200, 350 + yStep*3); addText('CARRY OUT FINAL', 1200, 320 + yStep*3);
        
        // Instanciar Full Adders
        let fa0 = createFullAdder(400, 50, 'Bit 0 (LSB)');
        let fa1 = createFullAdder(400, 50 + yStep, 'Bit 1');
        let fa2 = createFullAdder(400, 50 + yStep*2, 'Bit 2');
        let fa3 = createFullAdder(400, 50 + yStep*3, 'Bit 3 (MSB)');
        
        function connectToFA_A(inputNode, fa) {
            connect(inputNode, 0, fa.xor1_A.node, fa.xor1_A.pin);
            connect(inputNode, 0, fa.and1_A.node, fa.and1_A.pin);
        }
        function connectToFA_B(inputNode, fa) {
            connect(inputNode, 0, fa.xor1_B.node, fa.xor1_B.pin);
            connect(inputNode, 0, fa.and1_B.node, fa.and1_B.pin);
        }
        function connectToFA_Cin(sourceNode, sourcePinOut, fa) {
            connect(sourceNode, sourcePinOut, fa.xor2_Cin.node, fa.xor2_Cin.pin);
            connect(sourceNode, sourcePinOut, fa.and2_Cin.node, fa.and2_Cin.pin);
        }
        
        connectToFA_A(a0, fa0); connectToFA_B(b0, fa0); connectToFA_Cin(cin0, 0, fa0);
        connectToFA_A(a1, fa1); connectToFA_B(b1, fa1); 
        connectToFA_A(a2, fa2); connectToFA_B(b2, fa2); 
        connectToFA_A(a3, fa3); connectToFA_B(b3, fa3); 
        
        connectToFA_Cin(fa0.coutOut.node, fa0.coutOut.pin, fa1);
        connectToFA_Cin(fa1.coutOut.node, fa1.coutOut.pin, fa2);
        connectToFA_Cin(fa2.coutOut.node, fa2.coutOut.pin, fa3);
        
        connect(fa0.sumOut.node, fa0.sumOut.pin, s0, 0);
        connect(fa1.sumOut.node, fa1.sumOut.pin, s1, 0);
        connect(fa2.sumOut.node, fa2.sumOut.pin, s2, 0);
        connect(fa3.sumOut.node, fa3.sumOut.pin, s3, 0);
        
        connect(fa3.coutOut.node, fa3.coutOut.pin, coutFinal, 0);
    }
    
    saveState();
};
