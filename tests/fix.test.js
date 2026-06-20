// 针对修复的测试：敌机撞击玩家应当加分
import assert from 'node:assert/strict';
import { Enemy, Bullet } from '../public/js/entities.js';
import { Game } from '../public/js/game.js';

function mockCtx() {
  return new Proxy({}, { get() { return () => {}; }, set() { return true; } });
}
const mockCanvas = { getContext: () => mockCtx() };

// 测试 1：直接撞击玩家的敌机应该加分
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => false }, {});
  game.reset();
  game.player.invincible = 0; // 关闭无敌
  const cx = game.player.centerX();
  const cy = game.player.centerY();

  // 在玩家身上放一个 100 分的 grunt
  game.enemies.push(new Enemy('grunt', cx, cy, 1));
  const beforeScore = game.score;

  game._update(0.001);

  assert.equal(game.enemies.length, 0, '敌机应被清除');
  assert.equal(game.score, beforeScore + 100, `撞击应得 100 分（实际 ${game.score}）`);
  assert.equal(game.lives, 2, `撞击应扣一条命（实际 ${game.lives}）`);
  console.log('✓ 敌机撞击玩家：加分 + 扣命');
}

// 测试 2：无敌状态下撞击敌机也该加分（但不扣命）——无敌时我们跳过碰撞，这里要验证无敌不加分是预期行为
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => false }, {});
  game.reset();
  const cx = game.player.centerX();
  game.player.invincible = 1; // 无敌中
  game.enemies.push(new Enemy('grunt', cx, game.player.y, 1));

  game._update(0.001);

  assert.equal(game.score, 0, '无敌状态下撞击不应触发碰撞');
  console.log('✓ 无敌状态下撞击：正确跳过');
}

// 测试 3：子弹碰撞盒变宽，打偏一些的子弹也能命中
{
  const game = new Game(mockCanvas, { move: () => ({}), fire: () => false }, {});
  game.reset();
  // 手工放一颗子弹，x 坐标与敌机边缘仅差 1px（老碰撞盒 3px 会 miss，新 7px 会命中）
  const cx = game.player.centerX();
  const enemy = new Enemy('grunt', cx, 400, 1);
  game.enemies.push(enemy);
  // 子弹中心 x 距离敌机左边缘 1px 处
  const bulletX = enemy.x - 3; // 老碰撞盒：右边界 = x+3 = enemy.x，刚好 miss；新碰撞盒：右边界 = x+7 = enemy.x+4，命中
  const bulletY = 410;
  game.bullets.push(new Bullet(bulletX, bulletY, 0, -1000, 'player'));

  game._update(0.01);

  assert.equal(game.score, 100, `加宽碰撞盒后边缘子弹应命中并得分（实际 ${game.score}）`);
  console.log('✓ 加宽子弹碰撞盒：边缘子弹命中');
}

console.log('\n全部修复验证通过');
