const fs = require('fs');
let code = fs.readFileSync('src/index.js', 'utf8');

// 1. Add to assetMap
if (!code.includes("['./client-dist/winbox.bundle.js'")) {
    const assetMapTarget = "['./client-dist/roboto-2.woff2',        'src/client-dist/roboto-2.woff2'],";
    const assetMapReplacement = assetMapTarget + "\n    ['./client-dist/winbox.bundle.js',      'src/client-dist/winbox.bundle.js'],";
    code = code.replace(assetMapTarget, assetMapReplacement);
}

// 2. Add Express route
if (!code.includes('web.get("/winbox.bundle.js"')) {
    const routeTarget = "web.get(\"/renderer.js\", function (req, res) {\n  serveStaticFile(req, res, \"./src/renderer.js\", \"./renderer.js\", \"application/javascript\");\n});";
    const routeReplacement = routeTarget + "\nweb.get(\"/winbox.bundle.js\", function (req, res) {\n  serveStaticFile(req, res, \"./src/client-dist/winbox.bundle.js\", \"./client-dist/winbox.bundle.js\", \"application/javascript\");\n});";
    code = code.replace(routeTarget, routeReplacement);
    
    // Fallback if the exact target isn't found because of line endings
    if (!code.includes('web.get("/winbox.bundle.js"')) {
        const routeRegex = /web\.get\("\/renderer\.js", function \(req, res\) \{[\s\S]*?\}\);/;
        code = code.replace(routeRegex, match => match + "\nweb.get(\"/winbox.bundle.js\", function (req, res) {\n  serveStaticFile(req, res, \"./src/client-dist/winbox.bundle.js\", \"./client-dist/winbox.bundle.js\", \"application/javascript\");\n});");
    }
}

fs.writeFileSync('src/index.js', code);
console.log("Patched index.js to serve winbox.bundle.js");
