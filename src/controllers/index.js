import FileDatabase from '../db.js';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

let app;
try {
    app = require('electron').app;
} catch (e) {}

const userDataPath = app ? app.getPath('userData') : process.cwd();
const fileDb = new FileDatabase(path.join(userDataPath, 'file'));

export const home = (req, res) => {
    // This is a placeholder. In a real app, you'd render a view with video data.
    res.send('Welcome to the home page! Videos will be displayed here.');
};

export const getVideo = (req, res) => {
    const videoId = req.params.id;
    const video = fileDb.getFile(videoId);
    if (video) {
        res.send(`Playing video: ${video.fileName}`); // Placeholder
    } else {
        res.status(404).send('Video not found.');
    }
};

export const uploadVideo = (req, res) => {
    // Placeholder for video upload logic
    res.status(200).send('Video upload initiated (placeholder).');
};

export const addToQueue = (req, res) => {
    const { videoId } = req.body;
    if (videoId && fileDb.getFile(videoId)) {
        fileDb.addToQueue(videoId);
        res.status(200).send('Video added to queue.');
    } else {
        res.status(400).send('Invalid video ID or video not found.');
    }
};

export const removeFromQueue = (req, res) => {
    const { videoId } = req.body;
    if (videoId) {
        fileDb.removeFromQueue(videoId);
        res.status(200).send('Video removed from queue.');
    } else {
        res.status(400).send('Invalid video ID.');
    }
};

export const getQueue = (req, res) => {
    const queue = fileDb.getQueue();
    res.status(200).json(queue);
};

export const clearQueue = (req, res) => {
    fileDb.clearQueue();
    res.status(200).send('Queue cleared.');
};
