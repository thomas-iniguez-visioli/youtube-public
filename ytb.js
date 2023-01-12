const fs = require('fs'),utf8 =function (str) {
  const enc = new TextEncoder('utf-8');
  const u8s = enc.encode(str);

  return Array.from(u8s).map(v => String.fromCharCode(v)).join('');
}
const path =()=>{
  if(fs.existsSync("D:/OS.js-master/vfs/demo")){
    return "D:/OS.js-master/vfs/demo"
  }else{return process.env.userprofile+"\\Videos"}
}
function write(file,data){
  if(data=="undefined"){
      return("")  
  }
  if(!data){
      return("")
  }
 
  if (fs.existsSync(file)) {
      fs.appendFileSync(file,data)
  } else {
      fs.writeFileSync(file,"\n\n"+data)
  }

}   

async function get(id,title){
  //const youtube = await new Innertube()
 // const array = await youtube.getComments(id)
 // write("./.JSON",JSON.stringify(array))
 // for (let index = 0; index < array; index++) {
 //   const element = array[index];
   // const t = JSON.parse(JSON.stringify(element))
  //  logger(element)
   /// write(`./comment.txt`,"\n\n"+element.text)
  //}
  
}
async function start(answers,logger) {if(!answers){return}

var workerProcess = require("child_process").exec('ytdlp.exe --yes-playlist'+answers, 
function(error, stdout, stderr) { 
 if(error){ 
   logger(error.stack); 
   logger('Error code: '+error.code); 
   logger('Signal received: '+error.signal); 
  } 
 logger('stdout:'+stdout); 
 logger('stderr:'+stderr); 
}); 
workerProcess.on('exit',function(code){ 
logger('Child process exited with exit code '+code); 
});
}
async function id(answers,logger) {if(!answers){return}
var workerProcess = require("child_process").exec('ytdlp.exe --yes-playlist'+answers, 
function(error, stdout, stderr) { 
 if(error){ 
   logger(error.stack); 
   logger('Error code: '+error.code); 
   logger('Signal received: '+error.signal); 
  } 
 logger('stdout:'+stdout); 
 logger('stderr:'+stderr); 
}); 
workerProcess.on('exit',function(code){ 
logger('Child process exited with exit code '+code); })
}
async function main(n){
 
}
module.exports={main:function main(string,logger){start(string,logger)},cli:main,id:id,path:path}

