const fs = require('fs');
let code = fs.readFileSync('src/renderer.js', 'utf8');

const target = "document.body.appendChild(progressContainer);";
const replacement = "document.body.appendChild(progressContainer);\n            console.log('DOM loaded, WinBox available?', typeof WinBox);";

if (code.includes(target) && !code.includes('DOM loaded, WinBox available')) {
    code = code.replace(target, replacement);
    fs.writeFileSync('src/renderer.js', code);
}
console.log("Added load log");
