import express from 'express';
const router = express.Router();
import * as controller from '../controllers/index.js';

// Define routes and map them to controller functions
router.get('/', controller.home);
router.get('/video/:id', controller.getVideo);
router.post('/video', controller.uploadVideo);

export default router;
