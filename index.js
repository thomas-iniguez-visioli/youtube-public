const web = require('express')();
const express=require("express")
const fs=require("fs")
const http = require('http').Server(web);
const io = require('socket.io')(http);
const sleep=require("atomic-sleep")
const download=require("./ytb")
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
}
if(!fs.existsSync("./client-dist")){fs.mkdirSync("./client-dist")
build()}

const socketpath =()=>{
 
    return "./client-dist"
}
const usetube = require('ytfps')
var cors = require('cors')

  
  web.use(cors())


 
// or
const d=(input)=>{
      // Exemple d'une chaîne de caractères
      var str = input
    
      // Vérifie si la sous-chaîne existe dans la chaîne de caractères
      var playlist = str.indexOf("https://www.youtube.com/playlist?list=");
      var video = str.indexOf("https://www.youtube.com/watch?v="); 
      console.log(`playlist type =${playlist} \n video type =${video}`)    
      if(playlist !== -1){
        usetube(input).then(res => {
          console.log(res.videos);
          let array =res.videos
          for (let index = 0; index < array.length; index++) {
            
            const element = array[index];
            download.id(element.id,function log(string) {
              console.log(string); io.emit('chat message', string);
            })
            sleep(1000*(array.length-index))
          }
           
          })


      } else{
        if (video!==-1) {
          id =input.split("=")[1]
          download.id(id,function log(string) {
            console.log(string); io.emit('chat message', string);
          })
        } else {
          download.main(input,function log(string) {
            io.emit('chat message', string);
          })
        }
        
      }
  
}


console.log(download)
const port = process.env.PORT || 3040;

web.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});
web.use(express.static(socketpath()))


io.on('connection', (socket) => {
  io.emit('chat message', download.path()+" est le chemin ou sont les fichier entrée  le lien  ")
  socket.on('chat message', msg => {
    console.log(msg)
    d(msg,io)
    io.emit('chat message', msg);
  });
});



/*const { app, BrowserWindow } = require('electron')
const path = require('path')

function createWindow () {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

*/
http.listen(port, () => {
  console.log(`Socket.IO server running at http://localhost:${port}/`);
  //  app.whenReady().then(() => {
    //  createWindow()
  
     //app.on('activate', () => {
       //if (BrowserWindow.getAllWindows().length === 0) {
         //createWindow()
       //}else{createWindow()}
     //})
   //})
 });

//  app.on('window-all-closed', () => {
//    if (process.platform !== 'darwin') {
//     app.quit()
//    }
//  })
