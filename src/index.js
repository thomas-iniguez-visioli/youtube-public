require('electron');
const { app, BrowserWindow, ipcMain, dialog } = require('electron');
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
autoUpdater.allowDowngrade=true
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
  var msg;
  const command = `${app.getPath('userData')}\\ytdlp -vU --write-info-json --remux mp4 ${parameter} -f "bv*+ba/b" --write-playlist-metafiles --parse-metadata "playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$" -o "${app.getPath('userData')}/file/%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s" 
`;
    exec(command, (error, stdout, stderr) => {
      if (error) {
        msg=`exec error: ${error}`;
        console.log(msg)
        return msg;
      }
     msg=`stdout: ${stdout}`;
      msg+=`stderr: ${stderr}`;
      console.log(msg)
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
const { title } = require('process');
const base = path.join(app.getPath('userData'), 'file'); // Correction pour utiliser path.join pour une construction de chemin valide

web.set('view engine', 'ejs');
web.set('views', path.join(app.getPath('userData'), 'views'));

function build() {
  fs.mkdir(path.join(app.getPath('userData'), "src/"), { recursive: true }, (err) => {
    if (err) console.log(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), "src/client-dist"), { recursive: true }, (err) => {
    if (err) console.log(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), 'views'), { recursive: true }, (err) => {
    if (err) console.log(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), 'log'), { recursive: true }, (err) => {
    if (err) console.log(err);
  });
  fs.mkdir(base, { recursive: true }, (err) => {
    if (err) console.log(err);
  });
  try {
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js.map', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js.map')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    updateFile('https://github.com/yt-dlp/yt-dlp/releases/download/2023.02.17/yt-dlp.exe', path.join(app.getPath('userData'), 'ytdlp.exe')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/views/index.ejs', path.join(app.getPath('userData'), 'views/index.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/views/view.ejs', path.join(app.getPath('userData'), 'views/view.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/alphaleadership/youtube-public/refs/heads/main/src/renderer.js', path.join(app.getPath('userData'), 'src/renderer.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => console.log('downloaded file no issues...'))
    .catch((e) => console.error('error while downloading', e));
    
    //
  } catch (error) {
    console.log(error)
  }

 
}

try {
  
} catch (error) {
  console.log(error);
}
build()
const db = new d(base);
db.readDatabase()
db.save()
web.listen(8000, function () {
  console.log('Listening on port 8000!');
});

//const download = require('./ytb');
console.log('boot now');
function updateFile(url, dest) {
  const tempDest = `${dest}.tmp`;
  return get(url, tempDest)
    .then(() => {
      if(fs.existsSync(dest)){const originalFile = fs.readFileSync(dest);
        const newFile = fs.readFileSync(tempDest);
        if (originalFile.equals(newFile)) {
          fs.unlinkSync(tempDest);
          return Promise.reject('File contents are the same');
        } else {
          
        }}else{
          fs.renameSync(tempDest, dest);
          return Promise.resolve();
        }
      
    })
    .catch((err) => {
     // fs.unlinkSync(tempDest);
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
  db.readDatabase()
db.save()


//console.log(db.database)
  res.render('index', {
    results: db.database
    
})
})
web.get("/watch", function (req, res) {
  autoUpdater.checkForUpdatesAndNotify();
  if(db.getFile( req.query.id)==[]){
    download(`https://www.youtube.com/watch?v=${req.query.id}`)
  }
  let link=extractUrls(require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json"))).description)
  fs.appendFileSync(path.join(app.getPath('userData'), "detected.txt"),link.join("\t"))
  console.log(req.query)
  res.render('view', {
    code: req.query.id,
    videos:db.database,
    title:db.getFile( req.query.id).fileName,
    videodata:require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json")))
    
});
});
web.get("/delete", function (req, res) {
  console.log(req.query)
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
 // console.log(db.getFile( req.query.id))
  const videoPath = path.join(base, db.getFile( req.query.id).fileName) // Correction pour utiliser path.join pour une construction de chemin valide
//  console.log(videoPath)
 // console.log(req.query.id)
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
    
  }
);
win=mainWindow
autoUpdater.checkForUpdatesAndNotify();
ipcMain.on('execute-command', (e, arg) => {
  const  parameter  = arg;
  console.log(arg)
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

