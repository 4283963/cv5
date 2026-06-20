// 游戏核心逻辑测试：移动、碰撞、计分、生命、关卡推进（无浏览器环境）
import assert from 'node:assert/strict';
import { aabb, Player, Enemy, Bullet, Particle, explode } from '../public/js/entities.js';
import { Game } from '../public/js/game.js';

let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

// --- mock canvas context（代理：任意属性赋值 + 方法 no-op）---
function mockCtx() {
  return new Proxy(
    {},
    {
      get(target, prop) {
        if (prop in target) return target[prop];
        return () => {};
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      },
    }
  );
}
const mockCanvas = { getContext: () => mockCtx() };

// --- mock input ---
function makeInput(move, fire) {
  return { move: () => move, fire: () => fire };
}

console.log('Entities & 逻辑');

// 1. aabb
assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }), true);
assert.equal(aabb({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 5, h: 5 }), false);
ok('aabb 相交判定正确');

// 2. Player 移动 + 边界钳制 + 开火
{
  const bounds = { w: 480, h: 720 };
  const bullets = [];
  const p = new Player(240, 600);
  const input = makeInput({ left: true, right: false, up: false, down: false }, true);
  const startX = p.x;
  p.update(0.1, input, bounds, bullets);
  assert.ok(p.x < startX, '向左移动后 x 减小');
  assert.ok(bullets.length > 0, '按住空格生成子弹');
  ok('Player 移动与开火');
}
// 边界钳制
{
  const bounds = { w: 480, h: 720 };
  const p = new Player(240, 600);
  const input = makeInput({ left: true, right: false, up: false, down: false }, false);
  for (let i = 0; i < 200; i++) p.update(0.05, input, bounds, []);
  assert.ok(p.x >= 0 && p.x + p.w <= 480, '飞船不会移出左右边界');
  ok('Player 边界钳制');
}

// 3. Enemy 下落
{
  const e = new Enemy('grunt', 100, -20, 1);
  const startY = e.y;
  e.update(0.1, { w: 480, h: 720 }, [], null);
  assert.ok(e.y > startY, '敌机向下移动');
  ok('Enemy 下落');

  const tank = new Enemy('tank', 100, 0, 1);
  assert.equal(tank.hp, 4, 'tank 初始 4 血');
  tank.hit(2);
  assert.equal(tank.hp, 2, '受击后扣血');
  assert.equal(tank.dead, false, '2 血未死');
  tank.hit(2);
  assert.equal(tank.dead, true, '血量归零标记死亡');
  ok('Enemy 受击与死亡');
}

// 4. Bullet 飞行 + 出界标记
{
  const b = new Bullet(10, 10, 0, -100, 'player');
  b.update(0.1, { w: 480, h: 720 });
  assert.ok(b.y < 10, '子弹向上飞行');
  for (let i = 0; i < 200; i++) b.update(0.05, { w: 480, h: 720 });
  assert.equal(b.dead, true, '飞出顶部后标记死亡');
  ok('Bullet 飞行与出界清理');
}

// 5. explode 粒子
{
  const particles = [];
  explode(particles, 10, 10, '#fff', 16);
  assert.equal(particles.length, 16, '生成 16 个粒子');
  particles[0].update(1);
  assert.equal(particles[0].dead, true, '粒子寿命到期死亡');
  ok('Particle 爆炸');
}

// --- Game 集成 ---
console.log('Game 引擎集成');

// 6. 生命耗尽触发 onGameOver
{
  let overScore = null;
  const game = new Game(mockCanvas, makeInput({}, false), {
    onGameOver: (s) => { overScore = s; },
  });
  game.reset();
  assert.equal(game.lives, 3, '初始 3 条命');
  game._hitPlayer();
  assert.equal(game.lives, 2, '受击后 2 命');
  game._hitPlayer();
  game._hitPlayer();
  assert.equal(game.lives, 0, '受击 3 次后 0 命');
  assert.equal(game.state, 'over', '游戏状态变为 over');
  assert.equal(overScore, game.score, '回调收到正确分数');
  ok('生命耗尽 → 游戏结束回调');
}

// 7. 子弹命中敌机 → 计分（确定性：在玩家正上方放置敌机）
{
  const game = new Game(mockCanvas, makeInput({}, true), {});
  game.reset();
  game.enemies.push(new Enemy('grunt', game.player.centerX(), 120, 1));
  let crashed = false;
  try {
    for (let i = 0; i < 120 && game.score === 0; i++) {
      game._update(0.016);
      game._render();
    }
  } catch (e) {
    crashed = true;
    console.error(e);
  }
  assert.equal(crashed, false, '循环运行无异常');
  assert.ok(game.score > 0, `击毁敌机得分: ${game.score}`);
  ok('子弹命中敌机并计分');
}

// 8. 关卡推进
{
  const game = new Game(mockCanvas, makeInput({}, false), {});
  game.reset();
  const startWave = game.wave;
  game.killsThisWave = 100;
  game._checkWave();
  assert.ok(game.wave > startWave, '击杀达标后关卡推进');
  ok('关卡推进逻辑');
}

console.log(`\n全部通过：${passed} 项`);
