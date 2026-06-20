import { Router } from 'express';
import mongoose from 'mongoose';
import rateLimit from 'express-rate-limit';
import { Score } from '../models/Score.js';

const router = Router();

const submitLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '提交过于频繁，请稍后再试' },
});

function sanitizeUsername(raw) {
  if (typeof raw !== 'string') return null;
  const name = raw.trim();
  if (name.length < 1 || name.length > 12) return null;
  return name;
}

// 数据库未连接时立即返回，避免 Mongoose 缓冲 10s 超时
function dbReady() {
  return mongoose.connection.readyState === 1;
}
const DB_DOWN = { error: '排行榜暂时不可用，数据库未连接' };

router.get('/', async (_req, res) => {
  if (!dbReady()) return res.status(503).json(DB_DOWN);
  try {
    const scores = await Score.find()
      .sort({ score: -1, createdAt: 1 })
      .limit(10)
      .select('username score createdAt -_id')
      .lean();
    res.json({ scores });
  } catch (err) {
    console.error('[scores] 获取排行榜失败:', err.message);
    res.status(503).json({ error: '排行榜暂时不可用，请稍后再试' });
  }
});

router.post('/', submitLimiter, async (req, res) => {
  try {
    const { username, score } = req.body || {};
    const cleanName = sanitizeUsername(username);
    const numScore = Number(score);

    if (!cleanName) {
      return res.status(400).json({ success: false, error: '用户名需为 1-12 个字符' });
    }
    if (!Number.isFinite(numScore) || numScore < 0) {
      return res.status(400).json({ success: false, error: '分数无效' });
    }
    if (!dbReady()) {
      return res.status(503).json({ success: false, error: '数据库未连接，无法提交' });
    }

    await Score.create({ username: cleanName, score: numScore });
    const rank = (await Score.countDocuments({ score: { $gt: numScore } })) + 1;

    res.status(201).json({ success: true, rank });
  } catch (err) {
    console.error('[scores] 提交分数失败:', err.message);
    res.status(500).json({ success: false, error: '提交失败，请稍后再试' });
  }
});

export default router;
