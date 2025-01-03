require('electron');
const { app, BrowserWindow, ipcMain, dialog,Menu } = require('electron');
const { autoUpdater } = require("electron-updater")
const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const { exec } = require('child_process');
const log=require("electron-log")

if (!fs.existsSync(path.join(__dirname))) { // Correction pour utiliser path.join pour une construction de chemin valide
  fs.mkdirSync(path.join(__dirname)) // Correction pour utiliser path.join pour une construction de chemin valide
}
if (!fs.existsSync(path.join(app.getPath('userData'), "parsed.txt"))) { // Correction pour utiliser path.join pour une construction de chemin valide
  fs.writeFileSync(path.join(app.getPath('userData'), "parsed.txt"), "") // Correction pour utiliser path.join pour une construction de chemin valide
}
//autoUpdater.allowDowngrade=true
function getRedirectedUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(res.headers.location);
      } else {
        reject(new Error('No redirection found'));
      }
    }).on('error', (err) => {
      reject(err);
    });
  });
}
getRedirectedUrl("https://github.com/alphaleadership/youtube-public/releases/latest").then((url)=>{
  log.info(url.replace("tag","download")+"/latest.yml")
  autoUpdater.setFeedURL(url.replace("tag","download")+"")
  autoUpdater.checkForUpdatesAndNotify();
}).catch((err)=>{log.info(err)})
setInterval(() => {
  // Code à exécuter toutes les 2 minutes
  getRedirectedUrl("https://github.com/alphaleadership/youtube-public/releases/latest").then((url)=>{
    log.info(url.replace("tag","download")+"/latest.yml")
    autoUpdater.setFeedURL(url.replace("tag","download")+"")
    autoUpdater.checkForUpdatesAndNotify();
  }).catch((err)=>{log.info(err)})
}, 120000);




log.info(autoUpdater)
function extractUrls(text) {
  const urlRegex = /https?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  return text.match(urlRegex) || [];
}
let win;
function sendStatusToWindow(text) {
  log.info(text);
  win.webContents.send('message', text);
}
autoUpdater.on('checking-for-update', () => {
  sendStatusToWindow('Checking for update...');
})
autoUpdater.on('update-available', (info) => {
  
  sendStatusToWindow('Update available.');
})
autoUpdater.on('update-not-available', (info) => {
  sendStatusToWindow('Update not available.');
})
autoUpdater.on('error', (err) => {
  sendStatusToWindow('Error in auto-updater. ' + err);
})
autoUpdater.on('download-progress', (progressObj) => {
  let log_message = "Download speed: " + progressObj.bytesPerSecond;
  log_message = log_message + ' - Downloaded ' + progressObj.percent + '%';
  log_message = log_message + ' (' + progressObj.transferred + "/" + progressObj.total + ')';
 
  sendStatusToWindow(log_message);
})
autoUpdater.on('update-downloaded', (info) => {
  sendStatusToWindow('Update downloaded');
});

const download=(parameter)=>{
  fs.appendFileSync(path.join(app.getPath('userData'),'historic.txt'),`${parameter}\n`)
  var msg;
  const command = `${app.getPath('userData')}\\ytdlp -vU --write-info-json --remux mp4 ${parameter} -f "bv*+ba/b" --write-playlist-metafiles --parse-metadata "playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$" -o "${app.getPath('userData')}/file/%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s" 
`;
    const child = require('child_process');
    const childProcess = child.spawn(command, { shell: true });
    childProcess.stdout.on('data', (data) => {
      msg = `stdout: ${data}`;
      log.info(msg);
    });
    childProcess.stderr.on('data', (data) => {
      msg = `stderr: ${data}`;
      log.info(msg);
    });
    childProcess.on('close', (code) => {
      if (code !== 0) {
        msg = `exec error: ${code}`;
       log.info(msg);
      }
    });
    return msg
}
const web = express();
const http = require('http').Server(web);
const io = require('socket.io')(http);
const morgan = require('morgan');
const accessLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/access-"+`${new Date().toDateString()}`+".log"))
const errorLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/error-"+`${new Date().toDateString()}`+".log"))
web.use(morgan('combined', {stream: accessLogStream}));
web.use(morgan('combined', {skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream}));
const d = require('./db.js');

const base = path.join(app.getPath('userData'), 'file'); // Correction pour utiliser path.join pour une construction de chemin valide

web.set('view engine', 'ejs');
web.set('views', path.join(app.getPath('userData'), 'views'));

function build() {
  fs.mkdir(path.join(app.getPath('userData'), "src/"), { recursive: true }, (err) => {
    if (err) log.info(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), "src/client-dist"), { recursive: true }, (err) => {
    if (err) log.info(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), 'views'), { recursive: true }, (err) => {
    if (err) log.info(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), 'log'), { recursive: true }, (err) => {
    if (err) log.info(err);
  });
  fs.mkdir(base, { recursive: true }, (err) => {
    if (err) log.info(err);
  });
  try {
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js.map', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js.map')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://github.com/yt-dlp/yt-dlp/releases/download/2023.02.17/yt-dlp.exe', path.join(app.getPath('userData'), 'ytdlp.exe')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/views/index.ejs', path.join(app.getPath('userData'), 'views/index.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/views/view.ejs', path.join(app.getPath('userData'), 'views/view.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/renderer.js', path.join(app.getPath('userData'), 'src/renderer.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    
    //
  } catch (error) {
    log.info(error)
  }

 
}

try {
  
} catch (error) {
  log.info(error);
}
build()
const db = new d(base);
db.readDatabase()
db.save()
web.listen(8000, function () {
  log.info('Listening on port 8000!');
});
let  promptResponse;
ipcMain.on('prompt', function(eventRet, arg) {
   promptResponse = null
  var promptWindow = new BrowserWindow({
    width: 200,
    height: 100,
    show: false,
    resizable: false,
    movable: false,
    alwaysOnTop: true,
    frame: false
  })
  arg.val = arg.val || ''
  const promptHtml = '<label for="val">' + arg.title + '</label>\
  <input id="val" value="' + arg.val + '" autofocus />\
  <button onclick="require(\'electron\').ipcRenderer.send(\'prompt-response\', document.getElementById(\'val\').value);window.close()">Ok</button>\
  <button onclick="window.close()">Cancel</button>\
  <style>body {font-family: sans-serif;} button {float:right; margin-left: 10px;} label,input {margin-bottom: 10px; width: 100%; display:block;}</style>'
  promptWindow.loadURL('data:text/html,' + promptHtml)
  promptWindow.show()
  promptWindow.on('closed', function() {
    eventRet.returnValue = promptResponse
    download(promptResponse)
    promptWindow = null

  })
})
ipcMain.on('prompt-response', function(event, arg) {
  if (arg === ''){ arg = null }
  promptResponse = arg
  download(promptResponse)
})

//const download = require('./ytb');
log.info('boot now');
function updateFile(url, dest) {
  const tempDest = `${dest}.tmp`;
  return get(url, tempDest)
    .then(() => {
      if(fs.existsSync(tempDest)){
        if(fs.existsSync(dest)){
          const originalFile = fs.readFileSync(dest);
          const newFile = fs.readFileSync(tempDest);
          if (originalFile.equals(newFile)) {
            if(fs.existsSync(tempDest)){
              fs.unlinkSync(tempDest);
             } 
            return Promise.reject('File contents are the same');
          } else {
            
          }}else{
            fs.unlinkSync(dest)
            fs.renameSync(tempDest, dest);
            return Promise.resolve();
          }
      }
      return Promise.resolve();
     
      
    })
    .catch((err) => {
     if(fs.existsSync(tempDest)){
      fs.unlinkSync(tempDest);
     } 
      return Promise.reject(err);
    });
}



function get(url, dest) {
  return new Promise((resolve, reject) => {
    // Check file does not exist yet before hitting network
    fs.access(dest, fs.constants.F_OK, (err) => {
      if (err === null) reject('File already exists');

      const request = https.get(url, (response) => {
        if (response.statusCode === 200) {
          const file = fs.createWriteStream(dest, { flags: 'wx' });
          file.on('finish', () => resolve());
          file.on('error', (err) => {
            file.close();
            if (err.code === 'EEXIST') reject('File already exists');
            else fs.unlink(dest, () => reject(err.message)); // Delete temp file
          });
          response.pipe(file);
        } else if (response.statusCode === 302 || response.statusCode === 301) {
          // Recursively follow redirects, only a 200 will resolve.
          get(response.headers.location, dest).then(() => resolve());
        } else {
          reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
        }
      });
    });
  });
}
web.get("/", function (req, res) {
  
  autoUpdater.checkForUpdatesAndNotify();
  db.readDatabase();
  db.save();

  // Algorithme de référencement simplifié
  const database = db.database;
  const referencement = database.map(item => {
    const infoJson = require(path.join(app.getPath('userData'), 'file', item.fileName.replace(".mp4", ".info.json")));
    const score = infoJson.view_count * 0.5 + infoJson.like_count * 0.3 + infoJson.comment_count * 0.2;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);

  res.render('index', {
    results: referencement
  });
})
web.get("/watch", function (req, res) {
  autoUpdater.checkForUpdatesAndNotify();
  if(db.getFile( req.query.id)==[]){
    download(`https://www.youtube.com/watch?v=${req.query.id}`)
  }
  let link=extractUrls(require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json"))).description)
  fs.appendFileSync(path.join(app.getPath('userData'), "detected.txt"),link.join("\t"))
  //log.info(req.query)
  res.render('view', {
    code: req.query.id,
    videos:db.database,
    title:db.getFile( req.query.id).fileName,
    videodata:require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json")))
    
});
});
web.get("/delete", function (req, res) {
 // log.info(req.query)
  fs.rmSync(path.join(base, db.getFile( req.query.id).fileName))
  db.save()
  res.redirect("/")
});
web.get("/renderer.js",function (req, res) {
  res.statusCode=200
  res.send(fs.readFileSync(path.join(app.getPath('userData'), "./src/renderer.js"))) // Correction pour utiliser path.join pour une construction de chemin valide
})
web.get("/video", function (req, res) {
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send("Requires Range header");
  }
 // log.info(db.getFile( req.query.id))
  const videoPath = path.join(base, db.getFile( req.query.id).fileName) // Correction pour utiliser path.join pour une construction de chemin valide
//  log.info(videoPath)
 // log.info(req.query.id)
  const videoSize = fs.statSync(videoPath).size;

  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);
});
function createWindow() {
  build()
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), // Correction pour utiliser path.join pour une construction de chemin valide
      contextIsolation: true,
      enableRemoteModule: false,
    },
  });

  const menu = Menu.buildFromTemplate([
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Télécharger une vidéo',
          click() {
            const { dialog } = require('electron');
            log.info(dialog)
         
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'delete' },
        { role: 'selectall' }
      ]
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload' },
        { role: 'forcereload' },
        { role: 'toggledevtools' },
        { type: 'separator' },
        { role: 'resetzoom' },
        { role: 'zoomin' },
        { role: 'zoomout' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      label: 'Fenêtre',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    },
    {
      role: 'help',
      label: 'Aide',
      submenu: [
        {
          label: 'A propos de l\'application',
          click() {
            dialog.showMessageBox({
              type: 'info',
              icon: path.join(__dirname, 'assets/icon.png'),
              title: 'A propos de l\'application',
              message: 'Ceci est une application de téléchargement de vidéos.',
              buttons: ['OK']
            });
          }
        }
      ]
    }
  ]);

 // mainWindow.setMenu(menu);
win=mainWindow
autoUpdater.checkForUpdatesAndNotify();
ipcMain.on('execute-command', (e, arg) => {
  const  parameter  = arg;
  log.info(arg)
  var msg =download(parameter)
 
    
    return msg
  
});
  mainWindow.loadURL("http://localhost:8000");

  mainWindow.on('closed', () => {
   delete mainWindow
  });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

