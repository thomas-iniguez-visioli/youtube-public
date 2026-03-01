const FileDatabase = require('../db');
const path = require('path');
const { app } = require('electron'); // Assuming electron app object is available

const userDataPath = app.getPath('userData');
const fileDb = new FileDatabase(path.join(userDataPath, 'file'));


exports.home = (req, res) => {
    // This is a placeholder. In a real app, you'd render a view with video data.
    res.send('Welcome to the home page! Videos will be displayed here.');
};

exports.getVideo = (req, res) => {
    const videoId = req.params.id;
    const video = fileDb.getFile(videoId);
    if (video) {
        res.send(`Playing video: ${video.fileName}`); // Placeholder
    } else {
        res.status(404).send('Video not found.');
    }
};

exports.uploadVideo = (req, res) => {
    // Placeholder for video upload logic
    res.status(200).send('Video upload initiated (placeholder).');
};

exports.addToQueue = (req, res) => {
    const { videoId } = req.body;
    if (videoId && fileDb.getFile(videoId)) {
        fileDb.addToQueue(videoId);
        res.status(200).send('Video added to queue.');
    } else {
        res.status(400).send('Invalid video ID or video not found.');
    }
};

exports.removeFromQueue = (req, res) => {
    const { videoId } = req.body;
    if (videoId) {
        fileDb.removeFromQueue(videoId);
        res.status(200).send('Video removed from queue.');
    } else {
        res.status(400).send('Invalid video ID.');
    }
};

exports.getQueue = (req, res) => {
    const queue = fileDb.getQueue();
    res.status(200).json(queue);
};

exports.clearQueue = (req, res) => {
    fileDb.clearQueue();
    res.status(200).send('Queue cleared.');
};
