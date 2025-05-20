import express from 'express';
import { index } from '../controllers/user.js';

const router = express.Router();

router.get('/', index);

export default router;