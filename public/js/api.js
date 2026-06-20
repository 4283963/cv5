// 排行榜 API 客户端：与后端 /api/scores 交互
const BASE = '/api/scores';

export async function getScores() {
  const res = await fetch(BASE, { headers: { Accept: 'application/json' } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '排行榜暂时不可用');
  return Array.isArray(data.scores) ? data.scores : [];
}

export async function submitScore(username, score) {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username, score }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || '提交失败，请稍后再试');
  return data; // { success, rank }
}
