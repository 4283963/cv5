import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { config } from './config.js';
import scoresRouter from './routes/scores.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '16kb' }));

app.get('/api/health', (_req, res) => res.json({ status: 'ok', db: mongoose.connection.readyState }));

app.use('/api/scores', scoresRouter);

app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error('[server] 未捕获错误:', err.message);
  res.status(500).json({ error: '服务器内部错误' });
});

async function connectDb() {
  try {
    mongoose.set('strictQuery', true);
    await mongoose.connect(config.mongoUri);
    console.log('✓ MongoDB 已连接:', config.mongoUri);
  } catch (err) {
    console.warn('⚠ MongoDB 连接失败，排行榜功能将不可用:', err.message);
    console.warn('  请启动本地 MongoDB 或设置 MONGODB_URI 环境变量。');
  }
}

connectDb().finally(() => {
  app.listen(config.port, () => {
    console.log(`🚀 SPACE RAIDERS 服务已启动: http://localhost:${config.port}`);
  });
});
