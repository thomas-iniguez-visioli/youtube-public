const express = require('express');
const router = express.Router();
const controller = require('../controllers/index');

// Define routes and map them to controller functions
router.get('/', controller.home);
router.get('/video/:id', controller.getVideo);
router.post('/video', controller.uploadVideo);

module.exports = router;