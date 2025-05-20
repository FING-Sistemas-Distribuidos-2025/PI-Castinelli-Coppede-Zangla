import express from "express";
import {
  start,
  hit,
  stand,
  show
} from "../controllers/blackjack.js";

const router = express.Router();

router.post('/play', start);
router.post('/:sessionId/hit', hit);
router.post('/:sessionId/stand', stand);
router.get('/:sessionId', show);

export default router;
