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
const Innertube = require('youtubei.js');//require("./y")
const inquirer =require("inquirer")
async function get(id,title){
  //const youtube = await new Innertube()
 // const array = await youtube.getComments(id)
 // write("./.JSON",JSON.stringify(array))
 // for (let index = 0; index < array; index++) {
 //   const element = array[index];
   // const t = JSON.parse(JSON.stringify(element))
  //  console.log(element)
   /// write(`./comment.txt`,"\n\n"+element.text)
  //}
  
}
async function start(answers,logger) {if(!answers){return}
  const youtube = await new Innertube();
  console.log(logger)
 
  const search = await youtube.search(answers);
  var t=search.videos[0].title
  var file=t.split(" ").join("_").split("|").join("_").split('"').join("-")
 await get(search.videos[0].id,file)
 const stream = youtube.download(search.videos[0].id, {
    format: 'mp4', // Optional, defaults to mp4 and I recommend to leave it as it is unless you know what you're doing
    quality: '360p', // if a video doesn't have a specific quality it'll fall back to 360p, also ignored when type is set to audio
    type: 'videoandaudio' // can be “video”, “audio” and “videoandaudio”
  });
  var t=answers
  var file=t.split(" ").join("_").split("|").join("_").split('"').join("_").split('\\').join("-").split(':').join("-").split("%").join("-")
  //fs.writeFileSync(file+".mp4"," ")
  stream.pipe(fs.createWriteStream(`${path()}/${file}.mp4`));
const e=`${path()}/${file}.mp4`
  stream.on('start', () => {
    logger('[DOWNLOADER'+e+'] Starting download now!');
  });
  
  stream.on('info', (info) => {
    // { video_details: {..}, selected_format: {..}, formats: {..} }
    logger( `[DOWNLOADER ${e}] Downloading ${info.video_details.title} by ${info.video_details.metadata.channel_name} \n into ${path()}/${file}.mp4`);
  });
  
  stream.on('progress', (info) => {
    //console.log(`[DOWNLOADER] Downloaded ${info.percentage}% (${info.downloaded_size}MB) of ${info.size}MB`);
  });
  
  stream.on('end', () => {
    
    logger('[DOWNLOADER]'+e+' Done!');
  });
  
  stream.on('error', (err) => logger('[ERROR]'+e+JSON.stringify(err))); 
}
async function id(answers,logger) {if(!answers){return}
  const youtube = await new Innertube();

 
  const search =  await youtube.getDetails(answers);
  var t=search.title
  var file=t.split(" ").join("_").split("|").join("_").split('"').join("-").split("\\").join("_")

 const stream = youtube.download(answers, {
    format: 'mp4', // Optional, defaults to mp4 and I recommend to leave it as it is unless you know what you're doing
    quality: '360p', // if a video doesn't have a specific quality it'll fall back to 360p, also ignored when type is set to audio
    type: 'videoandaudio' // can be “video”, “audio” and “videoandaudio”
  });
  var t=search.title
  var file=t.split(" ").join("_").split("|").join("_").split('"').join("_").split('\\').join("-").split(':').join("-").split("%").join("-").split("/").join("-_-")
  //fs.writeFileSync(file+".mp4"," ")
  e=`${path()}/${file}.mp4`
  stream.pipe(fs.createWriteStream(e));
 
  stream.on('start', () => {
    logger('[DOWNLOADER]'+e+' Starting download now!');
  });
  
  stream.on('info', (info) => {
    // { video_details: {..}, selected_format: {..}, formats: {..} }
    logger( `[DOWNLOADER] Downloading ${info.video_details.title} by ${info.video_details.metadata.channel_name} \n into ${path()}/video/${file}.mp4`);
  });
  
  stream.on('progress', (info) => {
   
  });
  
  stream.on('end', () => {
    
    logger('[DOWNLOADER] Done!'+e);
  });
  
  stream.on('error', (err) => logger('[ERROR]'+e+JSON.stringify( err))
  );
  stream.on('error',(err)=>fs.rmSync(`${path()}/${file}.mp4`)) 
}
async function main(n){
 
}
module.exports={main:function main(string,logger){start(string,logger)},cli:main,id:id,path:path}

