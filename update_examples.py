import sys

file_path = "c:/Users/VICENT CARDONA/Documents/web-prof/js/simulador.js"
with open(file_path, "r", encoding="utf-8") as f:
    text = f.read()

old_func_start = "window.loadExample = function(level) {"
if old_func_start in text:
    part1 = text.split(old_func_start)[0]
else:
    part1 = text
    
new_func = """window.loadExample = function(level) {
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
"""

with open(file_path, "w", encoding="utf-8") as f:
    f.write(part1 + new_func)

print("Done examples and text injection")
