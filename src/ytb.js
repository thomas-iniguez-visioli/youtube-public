const fs = require('fs'),utf8 =function (str) {
  const enc = new TextEncoder('utf-8');
  const u8s = enc.encode(str);

  return Array.from(u8s).map(v => String.fromCharCode(v)).join('');
}
const path =()=>{
  if(fs.existsSync("D:/OS.js-master/vfs/demo")){
    return "D:/OS.js-master/vfs/demo"
  }else{"C:\\Users\\MPA\\Videos\\file\\"}
}
async function start(answers, folder, logger) {
  if (!answers) {
    return;
  }

  var workerProcess = require("child_process").exec(
    `cd ${folder} && ${process.cwd}\\ytdlp.exe --yes-playlist ${answers}`,
    function (error, stdout, stderr) {
      if (error) {
        logger(error.stack);
        logger("Error code: " + error.code);
        logger("Signal received: " + error.signal);
      }
      logger("stdout:" + stdout);
      logger("stderr:" + stderr);
    }
  );
  workerProcess.on("exit", function (code) {
    logger("Child process exited with exit code " + code);
  });
}

async function ide(answers, folder, logger) {
  if (!answers) {
    return;
  }
  var workerProcess = require("child_process").exec(
    ` cd ${folder} && ${process.cwd}\\ytdlp.exe --yes-playlist ${answers}`,
    function (error, stdout, stderr) {
      if (error) {
        logger(error.stack);
        logger("Error code: " + error.code);
        logger("Signal received: " + error.signal);
      }
      logger("stdout:" + stdout);
      logger("stderr:" + stderr);
    }
  );
  workerProcess.on("exit", function (code) {
    logger("Child process exited with exit code " + code);
  });
}

async function main(n) {}

module.exports = {
  main: function main(string,  logger) {
    start(string, path, logger);
  },
  cli: main,
  id: function id(string, logger) {
    ide(string,path, logger);
  },
  path: path,
};
