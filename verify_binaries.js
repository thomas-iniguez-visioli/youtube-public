const path = require('path');
const fs = require('fs');

// Mock global app for the resolver
global.app = {
    getPath: (name) => {
        if (name === 'userData') return path.join(process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Application Support' : process.env.HOME + '/.config'), 'youtube');
        return '';
    }
};

const binaryResolver = require('./src/binaryResolver');

async function test() {
    console.log('Resolved Paths:');
    console.log('ytdlp:', binaryResolver.ytdlp);
    console.log('ffmpeg:', binaryResolver.ffmpeg);
    console.log('bun:', binaryResolver.bun);
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
