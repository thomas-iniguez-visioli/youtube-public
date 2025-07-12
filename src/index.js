// require('./sentry.js');
/*const Sentry = require("@sentry/node");
const eSentry=require("@sentry/electron/main")
eSentry.init({
  dsn: "https://57d94ff25757e9923caba57bf1f2869f@o4508613620924416.ingest.de.sentry.io/4508619258331216",
});*/
//eSentry.profiler.startProfiler()
const { app, BrowserWindow, ipcMain, dialog,Menu } = require('electron');
const e=require("electron")
const cors =require("cors")
var booted=false
const {autoUpdater}=require("electron-updater")//require("./autoupdate")
const express = require('express');
const RateLimit = require('express-rate-limit');
const fs = require('fs');const https = require('https');
const path = require('path');

const child = require('child_process');
const log = require('electron-log');
log.transports.file.level = 'info';
log.transports.console.level = 'info';
log.transports.file.file = path.join(app.getPath('userData'), 'log', 'app.log');
const getconfig=()=>{
  if(fs.existsSync(path.join(app.getPath('userData'), 'config.json'))){
    return require(path.join(app.getPath('userData'), 'config.json'));
  }
  fs.writeFileSync(path.join(app.getPath('userData'), 'config.json'), JSON.stringify({
    "storagePath": path.join(app.getPath('userData'), 'file'),
    "videoUrlFormat": "https://www.youtube.com/watch?v=${id}",
    "outputFileFormat": "%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s"
  }))
  return require(path.join(app.getPath('userData'), 'config.json'))
}
const config = getconfig();
const corsOptions = {
  origin: function (origin, callback) {
    // Autoriser les requêtes sans origine (comme les requêtes locales ou les applications mobiles)
    if (!origin) return callback(null, true);

    // Autoriser les domaines spécifiques, par exemple YouTube
    if (['youtube.com', 'www.youtube.com'].includes(new URL(origin).hostname)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST'], // Spécifiez les méthodes HTTP autorisées
  allowedHeaders: ['Content-Type', 'Authorization'], // Spécifiez les en-têtes autorisés
  credentials: true, // Autoriser les cookies et les en-têtes d'authentification
};


// set up rate limiter: maximum of 100 requests per 15 minutes
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // max 100 requests per windowMs
});

  

//console.log(eSentry)

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
getRedirectedUrl("https://github.com/thomas-iniguez-visioli/youtube-public/releases/latest").then((url)=>{
 log.info(url.replace("tag","download")+"/latest.yml")
  autoUpdater.setFeedURL(url.replace("tag","download")+"")
  autoUpdater.checkForUpdatesAndNotify();
}).catch((err)=>{log.info(err)})
setInterval(() => {
  // Code à exécuter toutes les 2 minutes
  getRedirectedUrl("https://github.com/thomas-iniguez-visioli/youtube-public/releases/latest").then((url)=>{
  //  log.info(url.replace("tag","download")+"/latest.yml")
    autoUpdater.setFeedURL(url.replace("tag","download")+"")
    autoUpdater.checkForUpdatesAndNotify();
  }).catch((err)=>{
    //log.info(err)
  })
}, 120000);




//log.info(autoUpdater)
function extractUrls(text) {
  const urlRegex = /https?:\/\/(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+/g;
  return text.match(urlRegex) || [];
}
let win;
let isDownloading = false;
let processingQueue = false;
const QUEUE_FILE = path.join(app.getPath('userData'), 'video-queue.txt');

function sendStatusToWindow(text) {
  log.info(text);
  //win.webContents.send('message', text);
}

// Queue management functions
function loadQueue() {
  try {
    if (fs.existsSync(QUEUE_FILE)) {
      const content = fs.readFileSync(QUEUE_FILE, 'utf8');
      return content.split('\n').filter(id => id.trim());
    }
    return [];
  } catch (error) {
    log.error('Error loading queue:', error);
    return [];
  }
}

function saveQueue(queue) {
  try {
    fs.writeFileSync(QUEUE_FILE, queue.join('\n'));
  } catch (error) {
    log.error('Error saving queue:', error);
  }
}

function addToQueue(videoId) {
  const queue = loadQueue();
  if (!queue.includes(videoId)) {
    queue.push(videoId);
    saveQueue(queue);
    return true;
  }
  return false;
}

function removeFromQueue(videoId) {
  const queue = loadQueue();
  const index = queue.indexOf(videoId);
  if (index > -1) {
    queue.splice(index, 1);
    saveQueue(queue);
    return true;
  }
  return false;
}

function getQueueLength() {
  return loadQueue().length;
}

function getNextVideoId() {
  const queue = loadQueue();
  if (queue.length > 0) {
    const videoId = queue[0];
    removeFromQueue(videoId);
    return videoId;
  }
  return null;
}

// Function to process the download queue
function processQueue() {
  if (isDownloading || processingQueue||getQueueLength()===0) return;
  
  processingQueue = true;
  
  const videoId = getNextVideoId();
  if (videoId) {
    isDownloading = true;
    
    processVideoDownload(videoId).then(() => {
      isDownloading = false;
      processingQueue = false;
      processQueue(); // Process next item in queue
    }).catch((error) => {
      isDownloading = false;
      processingQueue = false;
      log.error('Error processing download:', error);
      processQueue(); // Continue with next item even if there's an error
    });
  } else {
    processingQueue = false;
  }
}
setTimeout(processQueue, 1000);
// Modified download function to use queue
const processVideoDownload = async (videoId) => {
  return new Promise((resolve, reject) => {
    if (isDownloading) {
      addToQueue(videoId);
      resolve('Added to queue');
      return;
    }
    const parameter=config.videoUrlFormat.replace("${id}",videoId)
    fs.appendFileSync(path.join(app.getPath('userData'),'historic.txt'),`${parameter}\n`);
    var msg;
    const args = [
      '-vU','--ffmpeg-location',path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl','bin'),
      '--write-info-json',
      '--remux', 'mp4',
      parameter,
      '-f', 'bv*+ba/b',
      '--write-playlist-metafiles',
      '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
      '-o', path.join(config.storagePath, config.outputFileFormat)
    ];
    const childProcess = child.spawn(`${app.getPath('userData')}\\ytdlp`, args);
    
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
        reject(msg);
      } else {
        resolve(msg);
      }
    });
  });
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
  const args = [
    '-vU','--ffmpeg-location',path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl','bin'),
    '--write-info-json',
    '--remux', 'mp4',
    parameter,
    '-f', 'bv*+ba/b',
    '--write-playlist-metafiles',
    '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
    '-o', path.join(config.storagePath, config.outputFileFormat)
  ];
  const child = require('child_process');
  const childProcess = child.spawn(`${app.getPath('userData')}\\ytdlp`, args);
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
const downloaddata=(parameter)=>{
  fs.appendFileSync(path.join(app.getPath('userData'),'historic.txt'),`${parameter}\n`)
  var msg;
  const execPath = `${app.getPath('userData')}\\ytdlp`;
  const args = [
    '-vU',
    '--write-info-json',
    '--simulate',
    '--no-clean-info-json',
    '--remux',
    'mp4',
    parameter,
    '-f',
    'bv*+ba/b',
    '--write-playlist-metafiles',
    '--parse-metadata', 'playlist_title:.+ - (?P<folder_name>Videos|Shorts|Live)$',
    '-o',
    path.join(config.storagePath, config.outputFileFormat),
    '-J',"--embed-metadata"
  ];
    const child = require('child_process');
    const childProcess = child.spawn(execPath, args);
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
const helmet = require('helmet');
//web.use(helmet());
//web.use(cors(corsOptions));
//eSentry.setupExpressErrorHandler(web);
const http = require('http').Server(web);
const io = require('socket.io')(http);
const morgan = require('morgan');
const accessLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/access-"+`${new Date().toDateString()}`+".log"))
const errorLogStream=fs.createWriteStream(path.join(app.getPath('userData'), "./log/error-"+`${new Date().toDateString()}`+".log"))
web.use(morgan('combined', {stream: accessLogStream}));
web.use(morgan('combined', {skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream}));
const d = require('./db.js');
const zipUrl='https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip'
updateFile(zipUrl, path.join(app.getPath('userData'), 'ffmpeg.zip')) // Correction pour utiliser path.join pour une construction de chemin valide
.then(() => {
  const unzipper = require('unzipper');
  fs.createReadStream(path.join(app.getPath('userData'), 'ffmpeg.zip')) // Correction pour utiliser path.join pour une construction de chemin valide
    .pipe(unzipper.Extract({ path: path.join(app.getPath('userData'), 'ffmpeg')})) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => {
      const binPath = path.join(app.getPath('userData'), 'ffmpeg', 'ffmpeg-master-latest-win64-gpl','bin');
      fs.readdir(binPath, (err, files) => {
        console.log(`les fichier sont : ${files}`)
        files.forEach(file => {
          console.log(file)
          fs.copyFileSync(path.join(binPath, file), path.join(app.getPath('userData'), file));
        });
      });
    });
});
const base = config.storagePath;

web.set('view engine', 'ejs');
web.set('views', path.join(app.getPath('userData'), 'views'));

async function build() {
  fs.mkdir(path.join(app.getPath('userData'), "src/"), { recursive: true }, (err) => {
    if (err){} //log.info(err);
  });
  fs.mkdir(path.join(app.getPath('userData'), "src/client-dist"), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(path.join(app.getPath('userData'), 'views'), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(path.join(app.getPath('userData'), 'log'), { recursive: true }, (err) => {
    if (err) {}
  });
  fs.mkdir(base, { recursive: true }, (err) => {
    if (err) {}
  });
  try {
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://cdn.socket.io/4.4.1/socket.io.js.map', path.join(app.getPath('userData'), 'src/client-dist/socket.io.js.map')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
   
    updateFile('https://github.com/yt-dlp/yt-dlp/releases/download/2023.02.17/yt-dlp.exe', path.join(app.getPath('userData'), 'ytdlp.exe')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => {
      log.info('downloaded file no issues...');

       
      
     
          
       
    })
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/views/index.ejs', path.join(app.getPath('userData'), 'views','index.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/views/view.ejs', path.join(app.getPath('userData'), 'views','view.ejs')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    updateFile('https://raw.githubusercontent.com/thomas-iniguez-visioli/youtube-public/refs/heads/main/src/renderer.js', path.join(app.getPath('userData'), 'src/renderer.js')) // Correction pour utiliser path.join pour une construction de chemin valide
    .then(() => log.info('downloaded file no issues...'))
    .catch((e) => log.info('error while downloading', e));
    path.join(app.getPath('userData'), 'views')
    //
  } catch (error) {
    log.info(error)
  }

 
}

try {
  
} catch (error) {
  log.info(error);
}
build().then((d)=>{
  web.listen(8001, function () {
    log.info('Listening on port 8000!');
    booted=!booted
  });
})
const db = new d(base);
db.readDatabase()
db.save()
db.database.forEach((item)=>{
  
})

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
  if(fs.existsSync(dest)){
    fs.unlinkSync(dest)
  }
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
            if(fs.existsSync(dest)){
              fs.unlinkSync(dest)
            }
            
            fs.renameSync(tempDest, dest);
            return Promise.resolve();
          }}
          else{
            if(fs.existsSync(dest)){
              fs.unlinkSync(dest)
            }
            
            fs.renameSync(tempDest, dest);
            return Promise.resolve();
          }
      }else{
        if(fs.existsSync(tempDest)){
          fs.unlinkSync(tempDest);
         } 
        return updateFile(url,dest)
      }
      //return Promise.resolve();
     
      
    })
    .catch((err) => {
      sendStatusToWindow(err)
     if(fs.existsSync(tempDest)){
      fs.unlinkSync(tempDest);
     } 
      return Promise.reject(dest +":"+err);
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
  fs.appendFileSync("./log.txt",app.getPath('exe').split(path.sep)[app.getPath('exe').split(path.sep).length-1])
  autoUpdater.checkForUpdatesAndNotify();
  db.readDatabase();
  db.save();

  // Algorithme de référencement simplifié
  const database = db.database;
  const referencement = database.map(item => {
    const infoJsonPath = path.join(app.getPath('userData'), 'file', item.fileName.replace(".mp4", ".info.json"));
    const mp4Path = path.join(app.getPath('userData'), 'file', item.fileName);
    console.log(`fichier ${mp4Path} status ${fs.existsSync(infoJsonPath)}`);
    if (!fs.existsSync(infoJsonPath)) {
      db.removeFile(item.yid);
      fs.unlinkSync(mp4Path);
      return; // sort de la boucle
    }
    let infoJson;
    try {
      infoJson = require(infoJsonPath);
    } catch (error) {
      console.error(`Erreur lors de la lecture de ${infoJsonPath}: ${error}`);
      db.removeFile(item.yid);
      fs.unlinkSync(mp4Path);
      return; // sort de la boucle
    }
    db.addTag(infoJson.display_id, infoJson.uploader);
    const score = infoJson.view_count * 0.5 + infoJson.like_count * 0.3 + infoJson.comment_count * 0.2;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);

  res.render('index', {
    results: referencement
  });
})
web.get("/watch", function (req, res) {
  console.log(req.query)
  autoUpdater.checkForUpdatesAndNotify();
  if(db.getFile( req.query.id)==[]){
    download(config.videoUrlFormat.replace('${id}', req.query.id))
    res.redirect("/")
    return 
  }
  downloaddata(require(path.join(base,db.getFile( req.query.id).fileName.replace(".mp4",".info.json"))).webpage_url)
  let link=extractUrls(require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json"))).description)
  fs.appendFileSync(path.join(app.getPath('userData'), "detected.txt"),link.join("\t"))
  //log.info(req.query)
  const database = db.database;
  const referencement = database.map(item => {
    const infoJson = require(path.join(app.getPath('userData'), 'file', item.fileName.replace(".mp4", ".info.json")));
    const score = infoJson.view_count * 0.5 + infoJson.like_count * 0.3 + infoJson.comment_count * 0.2;
    return { ...item, score };
  }).sort((a, b) => b.score - a.score);
  res.render('view', {
    code: req.query.id,
    videos:db.database,
    title:db.getFile( req.query.id).fileName,
    videodata:require(path.join(app.getPath('userData'), 'file',db.getFile( req.query.id).fileName.replace(".mp4",".info.json"))),
    nextVideo: referencement.findIndex(item => item.yid === req.query.id) === referencement.length - 1 ? referencement[0] : referencement[referencement.findIndex(item => item.yid === req.query.id) + 1]
});
});
web.post("/tag", function (req, res) {
  console.log(req.body)
  const videoId = req.body.videoId;
  const tag = req.body.tag;
  const videoData = db.getFile(videoId);
  if (videoData) {
    if (!videoData.tags.includes(tag)) {
      db.addTag(videoId,tag)
      db.save();
      res.send(`Tag "${tag}" added to video ${videoId}`);
    } else {
      res.send(`Tag "${tag}" already exists for video ${videoId}`);
    }
  } else {
    res.status(404).send(`Video ${videoId} not found`);
  }
});


web.get("/delete", function (req, res) {
 // log.info(req.query)
  fs.rmSync(path.join(base, db.getFile( req.query.id).fileName))
  db.save()
  res.redirect("/")
});
web.get("/api/search", function (req, res) {
  console.log(req.query)
  const tags = req.query.tags.split(',');
  const database = db.database;
  const results = database.filter(item => {
    return tags.some(tag => item.tags.includes(tag.trim()));
  });
  console.log(results)
  res.json(results);
});


web.get("/renderer.js",function (req, res) {
  res.statusCode=200
  res.send(fs.readFileSync(path.join(app.getPath('userData'), "./src/renderer.js"))) // Correction pour utiliser path.join pour une construction de chemin valide
})
web.get("/video", limiter, function (req, res) {
  log.info(req.query)  
  log.info(req.headers)
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send("Requires Range header");
  }
 // log.info(db.getFile( req.query.id))
  const fileName = db.getFile(req.query.id).fileName;
  if (fileName.includes('../') || fileName.includes('..\\')) {
    return res.status(400).send("Invalid file name");
  }
  const videoPath = path.join(base, fileName);
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
  mainWindow.loadURL("http://localhost:8001");

  mainWindow.on('closed', () => {
   delete mainWindow
  });
}
build().then((data)=>{
  app.on('activate', async() => {
    while (!booted) {
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    await sleep(10000);
    }
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
})
app.on('ready', () => {
  if (booted) {
    createWindow();
  } else {
    const checkBooted = setInterval(() => {
      if (booted) {
        clearInterval(checkBooted);
        createWindow();
      }
    }, 1000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
