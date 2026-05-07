import binaryResolver from './src/binaryResolver.js';
import path from 'path';
import fs from 'fs';

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
