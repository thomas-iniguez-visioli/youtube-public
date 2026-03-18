const binaryResolver = require('./src/binaryResolver');
const path = require('path');
const fs = require('fs');

async function test() {
  console.log('Resolving binaries...');
  console.log('ytdlp:', binaryResolver.ytdlp);
  console.log('ffmpeg:', binaryResolver.ffmpeg);
  console.log('deno:', binaryResolver.deno);
  console.log('ffmpegDir:', binaryResolver.ffmpegDir);

  const validation = await binaryResolver.validateBinaries();
  console.log('Validation results:', validation);
}

test();
