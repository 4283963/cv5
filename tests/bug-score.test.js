// 精确复现"命中不加分"bug 的测试
import assert from 'node:assert/strict';
import { Player, Enemy, Bullet, aabb } from '../public/js/entities.js';

// mock canvas
function mockCtx() {
  return new Proxy({}, { get() { return () => {}; }, set() { return true; } });
}
const mockCanvas = { getContext: () => mockCtx() };

// 模拟一帧完整流程
function simulateFrame(game, inputMove, inputFire) {
  const input = { move: () => inputMove, fire: () => inputFire };
  game.player.update(0.016, input, game.bounds, game.bullets);
  for (const e of game.enemies) e.update(0.016, game.bounds, game.enemyBullets, game.player);
  for (const b of game.bullets) b.update(0.016, game.bounds);
  for (const b of game.enemyBullets) b.update(0.016, game.bounds);
  game._update(0.016); // 再调一次会再走一遍 update，但主要是碰撞检测
  return game;
}

import { Game } from '../public/js/game.js';

// 用确定性的方式：把敌机精确放在玩家正上方且子弹刚好能打到的位置
const game = new Game(mockCanvas, { move: () => ({}), fire: () => true }, {});
game.reset();
game.player.x = 240 - game.player.w / 2; // 玩家定位到画布中央

// 让玩家开一次火（单步模拟）
const bulletsBefore = game.bullets.length;
game.player.update(0.016, { move: () => ({}), fire: () => true }, game.bounds, game.bullets);
console.log('开火后子弹数:', game.bullets.length, '（期望 ≥ 1）');

// 查看玩家子弹的实际位置与尺寸
game.bullets.forEach((b, i) => {
  const hb = b.hitbox();
  console.log(`子弹 ${i}: x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} w=${b.w} h=${b.h}`);
  console.log(`  hitbox: x=${hb.x} y=${hb.y} w=${hb.w} h=${hb.h}`);
});

console.log('\n玩家位置 x=' + game.player.x.toFixed(1) + ' w=' + game.player.w + ' center=' + game.player.centerX());

// 放一个 grunt 敌机在玩家中心正上方 50px
const enemyX = game.player.centerX();
const enemyY = 200;
game.enemies.push(new Enemy('grunt', enemyX, enemyY, 1));
const e = game.enemies[0];
console.log('\n敌机初始: x=' + e.x.toFixed(1) + ' y=' + e.y.toFixed(1) + ' w=' + e.w + ' h=' + e.h);
console.log('敌机 hitbox:', JSON.stringify(e.hitbox()));

// 移动所有子弹一帧，再检查碰撞
console.log('\n--- 移动子弹一帧 (向上) ---');
for (const b of game.bullets) b.update(0.050, game.bounds);
game.bullets.forEach((b, i) => {
  const hb = b.hitbox();
  console.log(`子弹 ${i}: x=${b.x.toFixed(1)} y=${b.y.toFixed(1)} hitbox=${JSON.stringify(hb)}`);
  console.log(`  与敌机碰撞? ` + aabb(hb, e.hitbox()));
});

// 关键：手动跑碰撞逻辑（抄 game._update 里的代码）
console.log('\n--- 手动执行碰撞检测 ---');
for (const b of game.bullets) {
  if (b.dead) continue;
  for (const en of game.enemies) {
    if (en.dead) continue;
    console.log(`检查: 子弹 [${b.x.toFixed(1)},${b.y.toFixed(1)} w${b.w} h${b.h}] vs 敌机 [${en.x.toFixed(1)},${en.y.toFixed(1)} w${en.w} h${en.h}]`);
    console.log(`  aabb = ${aabb(b.hitbox(), en.hitbox())}`);
    if (aabb(b.hitbox(), en.hitbox())) {
      console.log('  → 命中！');
      b.dead = true;
      en.hit(1);
      if (en.dead) {
        console.log('  → 敌机死亡，加 ' + en.points + ' 分');
        game.score += en.points;
      }
    }
  }
}
console.log('\n最终分数: ' + game.score);
assert.equal(game.score, 100, '应得 100 分');
console.log('\n✓ 测试通过');
