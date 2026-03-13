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

// Estats d'interacció del Ratolí
let mouse = { x: 0, y: 0, down: false, rightDown: false };
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

    isHovered(mx, my) {
        const pos = this.getAbsolutePos();
        const dx = mx - pos.x;
        const dy = my - pos.y;
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

    isHovered(mx, my) {
        // Retorna true si el ratolí està dins la seva àrea principal
        return (mx >= this.x && mx <= this.x + this.width &&
                my >= this.y && my <= this.y + this.height);
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
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('type', item.dataset.type);
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
        // Calculem les coordenades en l'escala interna del canvas
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        nodes.push(new LogicNode(type, x - 30, y - 30));
        
        // Amagar l'overlay tutorial quan s'afegeix un node
        const msg = document.getElementById('tutorial-msg');
        if (msg) msg.style.display = 'none';
    }
});

// Ratolí a dins del Canvas (Lògica Interna)
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
    }
    
    if (hoveringPin || wiringFromPin) {
        canvas.style.cursor = 'crosshair';
    } else {
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.down = true; // Click Esquerre
    
    // Si hem clicat un Pin, començar a cablejar
    if (hoveringPin && e.button === 0) {
        // Si el pin ja té connexió com a ENTRADA, desfem la connexió prèvia
        if (hoveringPin.type === 'in') {
            const connectXIdx = wires.findIndex(w => w.toPin === hoveringPin);
            if (connectXIdx !== -1) {
                // Recuperem el cable per tirar-lo endarrere
                wiringFromPin = wires[connectXIdx].fromPin;
                wires.splice(connectXIdx, 1);
                return;
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
    }
});

// Doble Clic per interaccions riques (Text o Interruptors fixos)
canvas.addEventListener('dblclick', (e) => {
    if (hoveringNode) {
        if (hoveringNode.type === 'TEXT') {
            const result = prompt("Escriu el text de l'etiqueta:", hoveringNode.text);
            if (result !== null) {
                hoveringNode.text = result;
            }
        } else if (hoveringNode.type === 'INPUT') {
            // Fixa de mode per si fa mandra clicar-lo molt en sistemes combinacionals complexos
            hoveringNode.active = !hoveringNode.active;
        }
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.down = false;
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
        }
    }
    
    wiringFromPin = null;
});

// Evitar menú de context del navegador al fer click dret al canvas
canvas.addEventListener('contextmenu', e => e.preventDefault());

// Suprimir nodes via Teclat
window.addEventListener('keydown', (e) => {
    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (hoveringNode) {
            wires = wires.filter(w => w.fromPin.node !== hoveringNode && w.toPin.node !== hoveringNode);
            nodes = nodes.filter(n => n !== hoveringNode);
            hoveringNode = null;
        }
    }
});

// Netejar Taulell
window.clearCircuit = function() {
    nodes = [];
    wires = [];
    const msg = document.getElementById('tutorial-msg');
    if (msg) msg.style.display = 'block';
};

// --- Bucle d'Animació i Simulació (Motor) ---

function loop() {
    // 1. Math Update (Actualitzar física lògica de portes endavant en l'ordre de l'array)
    // Utilitzem un "sweep" simple per resoldre combinacional (això no resol sistemes seqüencials purs bé excepte que oscil·lin lentament)
    // Executem un parell de passades per estabilitzar càlculs (propagació en cadena)
    for(let pass = 0; pass < 3; pass++) {
        nodes.forEach(node => node.evaluate());
    }

    // 2. Render
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

    // Dibuixar Tots els cables establerts
    wires.forEach(w => w.draw(ctx));

    // Dibuixar el cable interactiu creant-se ara mateix
    if (wiringFromPin) {
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

    requestAnimationFrame(loop);
}

// Iniciar Motor
loop();
