const fs = require('fs');
let code = fs.readFileSync('src/index.js', 'utf8');

const newRoute = `web.get("/patchnotes", function (req, res) {
  const jsonPath = require('path').join(__dirname, '../patchnotes.json');
  let patchnotes = [];
  if (fs.existsSync(jsonPath)) {
    try {
      patchnotes = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    } catch (e) {
      log.error('Erreur lecture patchnotes.json: ' + e.message);
    }
  } else {
    const projectRootPath = require('path').join(process.cwd(), 'patchnotes.json');
    if (fs.existsSync(projectRootPath)) {
      try {
        patchnotes = JSON.parse(fs.readFileSync(projectRootPath, 'utf8'));
      } catch (e) {
        log.error('Erreur lecture patchnotes.json: ' + e.message);
      }
    }
  }

  const historyLimit = Math.floor(db.database.length * 0.8);
  res.render('patchnotes', {
    patchnotes,
    favoritesCount: db.favorites.length,
    queueCount: db.queue.length,
    historyCount: db.history.length,
    historyLimit: historyLimit > 0 ? historyLimit : db.database.length,
    appVersion: pkg.version,
    backlogFile: typeof backlogFile !== 'undefined' ? backlogFile : ''
  });
});`;

const startIdx = code.indexOf('web.get("/patchnotes"');
let regex = /web\.get\("\/patchnotes"[\s\S]*?res\.render\('patchnotes'[\s\S]*?\}\);\n\}\);/;
code = code.replace(regex, newRoute);

// It's probably better to just slice manually if the regex fails.
const r2 = /web\.get\("\/patchnotes", function \(req, res\) \{[\s\S]*?res\.render\('patchnotes'[\s\S]*?\}\);\n\}\);/g;
if(code.match(r2)) {
    code = code.replace(r2, newRoute);
} else {
    // try finding index
    const s = code.indexOf('web.get("/patchnotes"');
    const e1 = code.indexOf("res.render('patchnotes'", s);
    const e2 = code.indexOf("});", e1);
    const e3 = code.indexOf("});", e2+3);
    code = code.substring(0, s) + newRoute + code.substring(e3 + 3);
}

fs.writeFileSync('src/index.js', code);
