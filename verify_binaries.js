import path from 'path';
import fs from 'fs';
import binaryResolver from './src/binaryResolver.js';

// Mock global app for the resolver
global.app = {
    getPath: (name) => {
        if (name === 'userData') return path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 'youtube');
        return '';
    }
};

async function test() {
    console.log('Resolved Paths:');
    console.log('ytdlp:', binaryResolver.ytdlp);
    console.log('ffmpeg:', binaryResolver.ffmpeg);
    console.log('deno:', binaryResolver.deno);
    console.log('ffmpegDir:', binaryResolver.ffmpegDir);

    console.log('\nValidating Binaries...');
    try {
        const validation = await binaryResolver.validateBinaries();
        console.log('Validation results:', validation);
    } catch (err) {
        console.error('Validation failed:', err);
    }
}

test();
