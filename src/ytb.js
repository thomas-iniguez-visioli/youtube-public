import fs from 'fs';
import child_process from 'child_process';

const path = () => {
  if (fs.existsSync("D:/OS.js-master/vfs/demo")) {
    return "D:/OS.js-master/vfs/demo";
  } else {
    return "C:\\Users\\MPA\\Videos\\file\\";
  }
}

async function start(answers, folder, logger) {
  if (!answers) {
    return;
  }

  const exePath = `${process.cwd()}\\ytdlp.exe`;
  const args = ["--yes-playlist", answers];
  var workerProcess = child_process.execFile(
    exePath,
    args,
    { cwd: folder },
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
  const exePath = `${process.cwd()}\\ytdlp.exe`;
  const args = ["--yes-playlist", answers];
  var workerProcess = child_process.execFile(
    exePath,
    args,
    { cwd: folder },
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

export default {
  main: function main(string, logger) {
    start(string, path(), logger);
  },
  cli: main,
  id: function id(string, logger) {
    ide(string, path(), logger);
  },
  path: path,
};
