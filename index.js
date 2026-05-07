import express from 'express';
const web = express();
import fs from 'fs';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import RateLimit from 'express-rate-limit';
import FileDatabase from './src/db.js';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import https from 'https';
import cors from 'cors';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let app;
try {
  app = require('electron').app;
} catch (e) {}

const httpServer = createServer(web);
const io = new SocketServer(httpServer);

let backlogFile = './backlog.txt';
try {
  if (app) backlogFile = path.join(app.getPath('desktop'), 'backlog.txt');
} catch (e) {}
const base ="./video"
const db = new FileDatabase(base);
web.locals.backlogFile = backlogFile;

const limiter = RateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
web.use(limiter);

function get(url, dest) {
  return new Promise((resolve, reject) => {
    // Check file does not exist yet before hitting network
    fs.access(dest, fs.constants.F_OK, (err) => {
        if (err === null) reject('File already exists');

        const request = https.get(url, response => {
            if (response.statusCode === 200) {
              const file = fs.createWriteStream(dest, { flags: 'wx' });
              file.on('finish', () => resolve());
              file.on('error', err => {
                file.close();
                if (err.code === 'EEXIST') reject('File already exists')
                else fs.unlink(dest, () => reject(err.message)); // Delete temp file
              });
              response.pipe(file);
            } else if (response.statusCode === 302 || response.statusCode === 301) {
              //Recursively follow redirects, only a 200 will resolve.
              get(response.headers.location, dest).then(() => resolve());
            } else {
              reject(`Server responded with ${response.statusCode}: ${response.statusMessage}`);
            }
          });
      
          request.on('error', err => {
            reject(err.message);
          });
    });
  });
}

function build() {
  get("https://cdn.socket.io/4.4.1/socket.io.js","./client-dist/socket.io.js")
  .then( ()=> console.log('downloaded file no issues...'))
  .catch( e => console.error('error while downloading', e));
  get("https://cdn.socket.io/4.4.1/socket.io.js.map","./client-dist/socket.io.js.map").then( ()=> console.log('downloaded file no issues...'))
  .catch( e => console.error('error while downloading', e));
  get("https://github.com/yt-dlp/yt-dlp/releases/download/2023.02.17/yt-dlp.exe","ytdlp.exe").then(()=> console.log('downloaded file no issues...'))  .catch( e => console.error('error while downloading', e));
  try {
    if (!fs.existsSync("./views")) fs.mkdirSync("./views");
    if (!fs.existsSync("./log")) fs.mkdirSync("./log");
    if (!fs.existsSync(base)) fs.mkdirSync(base);
  } catch (error) {
    console.log(error);
  }
}

if(!fs.existsSync("./client-dist")){
    fs.mkdirSync("./client-dist");
    build();
}

const socketpath = () => {
    return "./client-dist";
}

import morgan from 'morgan';
const accessLogStream = fs.createWriteStream("./log/access-" + `${new Date().toDateString()}` + ".log");
const errorLogStream = fs.createWriteStream("./log/error" + `${new Date().toDateString()}` + ".log");
web.use(morgan('combined', {stream: accessLogStream}));
web.use(morgan('combined', {skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream}));

db.readDatabase();
db.save();

web.set('view engine', 'ejs');
web.get("/", function (req, res) {
  res.render('index', {
    results: db.database
  });
});

web.get("/search", function (req, res) {
  res.render('index', {
    results: db.search(req.query.substring)
  });
});

web.get("/watch", function (req, res) {
  res.render('view', {
    code: req.query.id,
    title: db.getFile(req.query.id).fileName
  });
});

web.get("/video", function (req, res) {
  const range = req.headers.range;
  if (!range) {
    return res.status(400).send("Requires Range header");
  }

  const videoPath = base + db.getFile(req.query.id).fileName;
  const videoSize = fs.statSync(videoPath).size;

  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);

  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  res.writeHead(206, headers);
  const videoStream = fs.createReadStream(videoPath, { start, end });
  videoStream.pipe(res);
});

// Note: ytb.js path might be incorrect if it was legacy
let downloadModule;
try {
    downloadModule = (await import("./src/ytb.js")).default;
} catch (e) {
    console.warn("Could not load ytb module from src/ytb.js");
}

web.use(cors());

const down = (input) => {
    var str = input;
    var playlist = str.indexOf("https://www.youtube.com/playlist?list=");
    var video = str.indexOf("https://www.youtube.com/watch?v="); 
    
    if (!downloadModule) return;

    if(playlist !== -1){
        downloadModule.main(str, function log(string) {
            db.readDatabase();
            db.save();
            io.emit('chat message', string);
        });
    } else {
        if (video !== -1) {
            const id = input.split("=")[1];
            downloadModule.id(id, function log(string) {
                db.readDatabase();
                db.save();
                io.emit('chat message', string);
            });
        } else {
            downloadModule.main(input, function log(string) {
                io.emit('chat message', string);
            });
        }
    }
}

const port = process.env.PORT || 3040;
web.use(express.static(socketpath()));

io.on('connection', (socket) => {
  io.emit('chat message', (downloadModule ? downloadModule.path : "./video") + " est le chemin ou sont les fichier entrée le lien ");
  socket.on('chat message', msg => {
    down(msg);
    io.emit('chat message', msg);
  });
});

const { BrowserWindow } = require('electron');

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadURL("http://localhost:"+port)
}

httpServer.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
  if (app) {
    app.whenReady().then(() => {
      createWindow();
      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
          createWindow();
        }
      });
      app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') app.quit();
      });
    });
  }
});
