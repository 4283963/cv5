// 入口：初始化输入、游戏引擎、UI 状态机与排行榜联动
import { Input } from './input.js';
import { Game } from './game.js';
import { getScores, submitScore } from './api.js';

const $ = (id) => document.getElementById(id);

const canvas = $('game');
const input = new Input();
input.attach();

const game = new Game(canvas, input, {
  onHud: (score, wave, lives, powerup) => updateHud(score, wave, lives, powerup),
  onGameOver: (score) => showGameOver(score),
});

// ---- HUD ----
function updateHud(score, wave, lives, powerup = 0) {
  $('hudScore').textContent = score.toLocaleString();
  $('hudWave').textContent = wave;
  const livesEl = $('hudLives');
  livesEl.innerHTML = '';
  const max = Math.max(3, lives);
  for (let i = 0; i < max; i++) {
    const h = document.createElement('span');
    h.className = 'heart' + (i >= lives ? ' lost' : '');
    livesEl.appendChild(h);
  }
  const bar = $('powerupBar');
  const fill = $('powerupBarFill');
  if (powerup > 0) {
    bar.hidden = false;
    fill.style.width = Math.max(0, Math.min(100, (powerup / 5) * 100)) + '%';
  } else {
    bar.hidden = true;
  }
}

// ---- 覆盖层控制 ----
const overlays = {
  menu: $('menuOverlay'),
  pause: $('pauseOverlay'),
  over: $('gameoverOverlay'),
  board: $('boardOverlay'),
};

function hideAllOverlays() {
  for (const el of Object.values(overlays)) el.hidden = true;
}
function showOverlay(name) {
  hideAllOverlays();
  overlays[name].hidden = false;
}

// ---- 游戏流程 ----
function startGame() {
  hideAllOverlays();
  $('hud').hidden = false;
  $('powerupBar').hidden = true;
  $('touchPad').hidden = false;
  game.start();
}

function togglePause() {
  if (game.state === 'playing') {
    game.pause();
    overlays.pause.hidden = false;
  } else if (game.state === 'paused') {
    overlays.pause.hidden = true;
    game.resume();
  }
}

function showGameOver(score) {
  $('finalScore').textContent = score.toLocaleString();
  $('formHint').textContent = '';
  $('nameInput').value = '';
  showOverlay('over');
  setTimeout(() => $('nameInput').focus(), 50);
}

// ---- 分数提交 ----
async function handleSubmit(e) {
  e.preventDefault();
  const name = $('nameInput').value.trim();
  const hint = $('formHint');
  if (!name) {
    hint.textContent = '请输入你的名字（1-12 字符）';
    return;
  }
  const btn = $('submitBtn');
  btn.disabled = true;
  hint.textContent = '提交中…';
  try {
    const res = await submitScore(name, game.score);
    hint.style.color = '#39ff14';
    hint.textContent = res.rank ? `提交成功！排名第 ${res.rank} 位` : '提交成功！';
    btn.textContent = '已提交';
  } catch (err) {
    hint.style.color = '#ff2d95';
    hint.textContent = err.message || '提交失败，请重试';
    btn.disabled = false;
  }
}

// ---- 排行榜 ----
async function openLeaderboard() {
  showOverlay('board');
  const list = $('boardList');
  list.innerHTML = '<p class="subtitle">载入中…</p>';
  try {
    const scores = await getScores();
    if (!scores.length) {
      list.innerHTML = '<p class="subtitle">暂无记录，成为第一名！</p>';
      return;
    }
    list.innerHTML = '';
    scores.forEach((s, i) => {
      const row = document.createElement('div');
      const cls = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
      row.className = 'board-row ' + cls;
      row.innerHTML =
        `<span class="rank">${String(i + 1).padStart(2, '0')}</span>` +
        `<span class="name">${escapeHtml(s.username)}</span>` +
        `<span class="score">${Number(s.score).toLocaleString()}</span>`;
      list.appendChild(row);
    });
  } catch (err) {
    list.innerHTML = `<p class="subtitle" style="color:#ff2d95">${escapeHtml(err.message || '加载失败')}</p>`;
  }
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

// ---- 事件绑定 ----
$('startBtn').addEventListener('click', startGame);
$('resumeBtn').addEventListener('click', togglePause);
$('replayBtn').addEventListener('click', startGame);
$('scoreForm').addEventListener('submit', handleSubmit);
$('refreshBtn').addEventListener('click', openLeaderboard);
$('closeBoardBtn').addEventListener('click', () => {
  if (game.state === 'over') showOverlay('over');
  else showOverlay('menu');
});
$('menuBoardBtn').addEventListener('click', openLeaderboard);
$('overBoardBtn').addEventListener('click', openLeaderboard);

// 键盘：P 暂停 / Enter 开始
window.addEventListener('keydown', (e) => {
  if (e.code === 'KeyP' && (game.state === 'playing' || game.state === 'paused')) {
    e.preventDefault();
    togglePause();
  }
  if (e.code === 'Enter' && !overlays.menu.hidden && game.state === 'idle') {
    startGame();
  }
});

// 移动端虚拟手柄
document.querySelectorAll('.tbtn[data-key]').forEach((btn) => {
  const code = btn.dataset.key;
  const press = (e) => { e.preventDefault(); input.setVirtual(code, true); };
  const release = (e) => { e.preventDefault(); input.setVirtual(code, false); };
  btn.addEventListener('touchstart', press, { passive: false });
  btn.addEventListener('touchend', release, { passive: false });
  btn.addEventListener('touchcancel', release, { passive: false });
  btn.addEventListener('mousedown', press);
  btn.addEventListener('mouseup', release);
  btn.addEventListener('mouseleave', release);
});

// 失焦自动暂停
window.addEventListener('blur', () => {
  if (game.state === 'playing') togglePause();
});

updateHud(0, 1, 3);
