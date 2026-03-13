import os

file_path = "c:/Users/VICENT CARDONA/Documents/web-prof/js/simulador.js"

with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

# 1. Substitute prompt() with inline editor
old_dblclick = """// Doble Clic per interaccions riques (Text o Interruptors fixos)
canvas.addEventListener('dblclick', (e) => {
    if (hoveringNode) {
        if (hoveringNode.type === 'TEXT') {
            const result = prompt("Escriu el text de l'etiqueta:", hoveringNode.text);
            if (result !== null) {
                hoveringNode.text = result;
                saveState();
            }
        } else if (hoveringNode.type === 'INPUT') {
            hoveringNode.active = !hoveringNode.active;
            saveState();
        }
    }
});"""

new_dblclick = """// --- EDITOR DE TEXT INLINE ---
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
});"""
text = text.replace(old_dblclick, new_dblclick)

# 2. Add Exemples logic at the end of the file
exemples_code = """

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
        
        // Waypoints per fer cables macos cap a baix (Opcional, de moment directe)
        
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
        // Posicionament estratègic
        camera.zoom = 0.8; // Allunyar càmara per veure-ho tot
        camera.x = 50; camera.y = 50;
        
        let a = addNode('INPUT', 100, 150); addText('A (Bit 0)', 100, 120);
        let b = addNode('INPUT', 100, 250); addText('B (Bit 1)', 100, 220);
        let cin = addNode('INPUT', 100, 400); addText('Carry IN', 100, 370);
        
        // Fase 1: Primer Semi-Sumador
        let xor1 = addNode('XOR', 350, 200);
        let and1 = addNode('AND', 350, 300);
        
        connect(a, 0, xor1, 0); connect(b, 0, xor1, 1);
        connect(a, 0, and1, 0); connect(b, 0, and1, 1);
        
        // Fase 2: Segon Semi-Sumador (aplica Carry IN)
        let xor2 = addNode('XOR', 600, 275);
        let and2 = addNode('AND', 600, 425);
        
        connect(xor1, 0, xor2, 0); connect(cin, 0, xor2, 1);
        connect(xor1, 0, and2, 0); connect(cin, 0, and2, 1);
        
        // Fase 3: OR per saber si hi ha Acarreig de sortida global
        let or = addNode('OR', 800, 360);
        connect(and2, 0, or, 0); connect(and1, 0, or, 1);
        
        // Sortides finals
        let sum = addNode('OUTPUT', 950, 275); addText('SUMA FINAL', 950, 245);
        let cout = addNode('OUTPUT', 950, 360); addText('CARRY OUT (Acarreig)', 950, 330);
        
        connect(xor2, 0, sum, 0);
        connect(or, 0, cout, 0);
    }
    
    // Netejar historial perquè no desfacin fins l'anterior circuit
    saveState();
};
"""
text += exemples_code

with open(file_path, "w", encoding="utf-8") as f:
    f.write(text)

print("Done examples and text injection")
