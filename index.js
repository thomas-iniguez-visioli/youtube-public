const web = require('express')();
const express=require("express")
const fs=require("fs")
const http = require('http').Server(web);
const io = require('socket.io')(http);
const rateLimit = require('express-rate-limit');

const d=require("./src/db.js")
const base ="./video"
const db=new d(base)

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
web.use(limiter);

function build() {
  get("https://cdn.socket.io/4.4.1/socket.io.js","./client-dist/socket.io.js")
  .then( ()=> console.log('downloaded file no issues...'))
  .catch( e => console.error('error while downloading', e));
  get("https://cdn.socket.io/4.4.1/socket.io.js.map","./client-dist/socket.io.js.map").then( ()=> console.log('downloaded file no issues...'))
  .catch( e => console.error('error while downloading', e));
  get("https://github.com/yt-dlp/yt-dlp/releases/download/2023.02.17/yt-dlp.exe","ytdlp.exe").then(()=> console.log('downloaded file no issues...'))  .catch( e => console.error('error while downloading', e));
  try {
    fs.mkdirSync("./views")
    fs.mkdirSync("./log")
    fs.mkdirSync(base)
   
  } catch (error) {
    console.log(error)
  }
}
try {

} catch (error) {
  console.log(error)
}
if(!fs.existsSync("./client-dist")){fs.mkdirSync("./client-dist")
build()}

const socketpath =()=>{

    return "./client-dist"
}


const morgan = require('morgan');
const accessLogStream=fs.createWriteStream("./log/access-"+`${new Date().toDateString()}`+".log")
const errorLogStream=fs.createWriteStream("./log/error"+`${new Date().toDateString()}`+".log")
web.use(morgan('combined', {stream: accessLogStream}));
web.use(morgan('combined', {skip: function (req, res) { return res.statusCode < 400 }, stream: errorLogStream}));
db.readDatabase()
db.save()
db.database.map((item)=>{item.yid})
web.set('view engine', 'ejs');
web.get("/", function (req, res) {

  res.render('index', {
    results: db.database
    
});
})
web.get("/search", function (req, res) {
  console.log(db.search(req.query.substring))
  res.render('index', {
    results: db.search(req.query.substring)
    
});
})
web.get("/watch", function (req, res) {
  console.log(req.query)
  res.render('view', {
    code: req.query.id,
    title:db.getFile( req.query.id).fileName
   
    
});
});
web.get("/video", function (req, res) {
  // Chargez les données de la base de données à partir du fichier


  // Trouvez l'entrée de session de vidéo correspondante
  let startTime = 0;
  let endTime = 0;
 

  // Si l'heure de fin est définie, utilisez-la comme point de départ pour l'en-tête Range
  // sinon, utilisez l'heure de début comme point de départ
  let rangeStart = 0;
  if (endTime) {
    rangeStart = endTime;
  } else {
    rangeStart = startTime;
  }

  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send("Requires Range header");
  }

  const videoPath =base+ db.getFile( req.query.id).fileName
  console.log(videoPath)
  console.log()
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

  // Create a new entry in the database for this video session


  // Enregistrez les données mises à jour dans le fichier
  
  
  // create video read stream for this particular chunk
  const videoStream = fs.createReadStream(videoPath, { start, end });

  // Stream the video chunk to the client
  videoStream.pipe(res);

  // When the stream ends, save the end time in the database
  videoStream.on("end", () => {
    // Chargez à nouveau les données de la base de données à partir du fichier
    

    // Enregistrez les données mises à jour dans le fichier
  
  });
});

web.listen(8000, function () {
  console.log("Listening on port 8000!");
});

const download=require("./nextgen/my-electron-app/src/ytb.js")
const https=require("https")
console.log("boot now")
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
            } else if (response.statusCode === 302 or response.statusCode === 301) {
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
var cors = require('cors')

  
  web.use(cors())


 
// or
const down=(input)=>{
      // Exemple d'une chaîne de caractères
      var str = input
    
      // Vérifie si la sous-chaîne existe dans la chaîne de caractères
      var playlist = str.indexOf("https://www.youtube.com/playlist?list=");
      var video = str.indexOf("https://www.youtube.com/watch?v="); 
      console.log(`playlist type =${playlist} \n video type =${video}`)    
      if(playlist !== -1){
          download.main(str,function log(string) {
	db.readDatabase()
db.save()
            io.emit('chat message', string);
          })


      } else{
        if (video!==-1) {
          id =input.split("=")[1]
          download.id(id,function log(string) {
db.readDatabase()
db.save()
            console.log(string); io.emit('chat message', string);
          })
        } else {
          download.main(input,function log(string) {
            io.emit('chat message', string);
          })
        }
        
      }
  
}
const port = process.env.PORT || 3040;


web.use(express.static(socketpath()))


io.on('connection', (socket) => {
  io.emit('chat message', download.path+" est le chemin ou sont les fichier entrée  le lien  ")
  socket.on('chat message', msg => {
    //console.log(msg)
    down(msg,io)
    io.emit('chat message', msg);
  });
});


const { app, BrowserWindow } = require('electron')
console.log(app)
const path = require('path')

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


http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
    app.whenReady().then(() => {
      createWindow()
  
     app.on('activate', () => {
       if (BrowserWindow.getAllWindows().length === 0) {
         createWindow()
       }else{createWindow()}
     })
     app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
      app.quit()
     }
    })
   })
});
