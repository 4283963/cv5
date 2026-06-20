// 星星道具 + 三向散射 Buff 功能测试
import assert from 'node:assert/strict';
import { StarPowerUp, Player, Enemy, Bullet } from '../public/js/entities.js';
import { Game } from '../public/js/game.js';

function mockCtx() {
  return new Proxy({}, { get() { return () => {}; }, set() { return true; } });
}
const mockCanvas = { getContext: () => mockCtx() };

let passed = 0;
const ok = (name) => { passed++; console.log('  ✓', name); };

console.log('StarPowerUp 实体');
{
  const s = new StarPowerUp(200, 300);
  assert.equal(s.w, 20, '星星宽度');
  assert.equal(s.h, 20, '星星高度');
  assert.equal(s.x, 190, '星星 x 居中偏移');
  assert.equal(s.y, 290, '星星 y 居中偏移');
  const hb = s.hitbox();
  assert.equal(hb.x, 193, '碰撞盒 x 内缩');
  assert.equal(hb.w, 14, '碰撞盒宽度内缩');
  s.update(1, { w: 480, h: 720 });
  assert.equal(s.y > 290, true, '星星向下掉落');
  ok('星星属性与碰撞盒正确');
}
{
  const s = new StarPowerUp(200, 700);
  s.update(1, { w: 480, h: 720 });
  assert.equal(s.dead, true, '掉出屏幕标记 dead');
  ok('星星出界清理');
}

console.log('\nPlayer 强化状态');
{
  const p = new Player(240, 600);
  assert.equal(p.isPoweredUp(), false, '初始未强化');
  p.activatePowerup(5);
  assert.equal(p.powerup, 5, '激活后 powerup = 5');
  assert.equal(p.isPoweredUp(), true, 'isPoweredUp() = true');
  p.update(2, { move: () => ({}), fire: () => false }, { w: 480, h: 720 }, []);
  assert.ok(p.powerup < 5 && p.powerup > 0, 'update 后倒计时递减');
  // 强化中再次拾取，取更大值（叠加延长）
  p.activatePowerup(10);
  assert.equal(p.powerup, 10, '再次拾取取更大值，延长 Buff');
  // 剩余时间短的星星不覆盖已有的长 Buff
  p.activatePowerup(2);
  assert.equal(p.powerup, 10, '拾取更短 Buff 不覆盖当前');
  ok('强化状态激活与倒计时');
}

console.log('\n三向散射弹幕');
{
  const p = new Player(240, 600);
  const bullets = [];
  p._fireNormal(bullets);
  assert.equal(bullets.length, 2, '普通射击 2 颗子弹');
  assert.equal(bullets[0].vx, 0, '普通子弹水平速度为 0');
  bullets.length = 0;
  p.activatePowerup(5);
  p._fireSpread(bullets);
  assert.equal(bullets.length, 3, '散射射击 3 颗子弹');
  const vxs = bullets.map(b => b.vx);
  assert.ok(vxs[0] < 0, '左弹有负水平速度');
  assert.equal(vxs[1], 0, '中弹水平速度为 0');
  assert.ok(vxs[2] > 0, '右弹有正水平速度');
  const vys = bullets.map(b => b.vy);
  assert.ok(vys.every(v => v < 0), '所有子弹向上飞');
  ok('三向散射角度正确');
}
{
  // 射击模式切换
  const p = new Player(240, 600);
  const input = { move: () => ({}), fire: () => true };
  // 未强化时发射普通弹
  const b1 = [];
  p.update(0.2, input, { w: 480, h: 720 }, b1);
  assert.equal(b1.length, 2, '未强化：2 颗弹');
  // 强化后发射散射弹
  p.activatePowerup(5);
  const b2 = [];
  p.cooldown = 0;
  p.update(0.2, input, { w: 480, h: 720 }, b2);
  assert.equal(b2.length, 3, '强化中：3 颗散射弹');
  ok('射击模式自动切换');
}

console.log('\n游戏集成：敌机死亡掉落星星 + 拾取激活 Buff');
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => false }, {});
  game.reset();
  // 直接放置一个星星道具
  game.powerups.push(new StarPowerUp(200, 300));
  assert.equal(game.powerups.length, 1, '场景中有一个星星');
  // 让玩家正好在星星位置
  game.player.x = 200 - game.player.w / 2;
  game.player.y = 300 - game.player.h / 2;
  game.player.invincible = 0;
  // 一帧更新：检测碰撞
  game._update(0.01);
  assert.equal(game.powerups.length, 0, '拾取后星星被移除');
  assert.equal(game.player.isPoweredUp(), true, '拾取后玩家进入强化状态');
  ok('拾取星星 + 激活 Buff');
}

console.log('\n敌机被击杀后 20% 概率掉落星星');
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => false }, {});
  game.reset();
  // 在玩家中心正上方放一个 grunt 敌机
  const cx = game.player.centerX();
  game.enemies.push(new Enemy('grunt', cx, 100, 1));
  // 用一颗精确位置的子弹打它，强制 Math.random < 0.2 必掉星星
  const origRandom = Math.random;
  let dropCheck = 0;
  Math.random = () => { dropCheck++; return 0.1; };
  // 放一颗正好能命中的子弹
  game.bullets.push(new Bullet(cx - 2, 90, 0, 1000, 'player'));
  game._update(0.01);
  Math.random = origRandom;
  assert.equal(game.enemies.length, 0, '敌机被击杀');
  assert.equal(game.score, 100, '得分 100');
  assert.equal(game.powerups.length, 1, '掉落 1 颗星星');
  assert.ok(dropCheck >= 1, `Math.random 被调用了 ${dropCheck} 次`);
  ok('敌机被击杀后概率掉落星星');
}

console.log('\n强化 Buff 持续时间：5 秒后失效');
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => true }, {});
  game.reset();
  game.player.activatePowerup(5);
  assert.equal(game.player.isPoweredUp(), true);
  // 模拟 4.9 秒
  for (let i = 0; i < 49; i++) {
    game._update(0.1);
  }
  assert.equal(game.player.isPoweredUp(), true, '4.9s 时仍在强化中');
  // 再过 0.15 秒，超过 5s
  game._update(0.15);
  assert.equal(game.player.isPoweredUp(), false, '5s 后强化失效');
  // 恢复普通射击
  const bullets = [];
  game.player.cooldown = 0;
  game.player.update(0.2, { move: () => ({}), fire: () => true }, { w: 480, h: 720 }, bullets);
  assert.equal(bullets.length, 2, '失效后恢复 2 颗弹');
  ok('Buff 计时正确，到期后恢复普通射击');
}

console.log(`\n全部通过：${passed} 项`);
