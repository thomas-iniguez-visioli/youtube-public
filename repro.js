const { createDownloadArgs } = require('./src/downloader');
const path = require('path');
const fs = require('fs');

const parameter = 'https://www.youtube.com/watch?v=YC1XwvNxfSE';
const ffmpegDir = 'C:/fake/ffmpeg/bin';
const storagePath = 'C:/fake/storage';
const outputFileFormat = '%(channel|)s-%(folder_name|)s-%(title)s [%(id)s].%(ext)s';
const bunPath = 'C:/fake/bun.exe';

try {
    const args = createDownloadArgs(parameter, ffmpegDir, storagePath, outputFileFormat, bunPath);
    console.log('Arguments générés :');
    console.log(JSON.stringify(args, null, 2));
} catch (error) {
    console.error('Erreur lors de la génération des arguments :', error);
}
