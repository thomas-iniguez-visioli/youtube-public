const fs = require('fs');
let code = fs.readFileSync('src/renderer.js', 'utf8');

const target = "if (typeof WinBox !== 'undefined' && !window.progressWinBox) {";
const replacement = "console.log('Download progress! WinBox type:', typeof WinBox);\n              if (typeof WinBox !== 'undefined' && !window.progressWinBox) {";

if (code.includes(target) && !code.includes('WinBox type')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/renderer.js', code);
}
console.log("Added console.log");
