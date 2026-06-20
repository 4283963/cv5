// 精确模拟真实游戏流程：玩家开火 + 敌机从上方掉落 经过很多帧 最终被击中
import { Player, Enemy, Bullet, aabb, ENEMY_CONFIG } from '../public/js/entities.js';
import { Game } from '../public/js/game.js';

function mockCtx() {
  return new Proxy({}, { get() { return () => {}; }, set() { return true; } });
}
const mockCanvas = { getContext: () => mockCtx() };

const game = new Game(mockCanvas, { move: () => ({}), fire: () => true }, {});
game.reset();

// 直接在玩家正上方很近处放一个 grunt（敌机 y=500，玩家在 y~630，玩家子弹向上飞 560px/s）
const cx = game.player.centerX();
console.log('玩家中心 x=' + cx + ', 玩家 y=' + game.player.y.toFixed(1));
game.enemies.push(new Enemy('grunt', cx, 500, 1));
const e0 = game.enemies[0];
console.log('敌机 0 x=' + e0.x.toFixed(1) + ' y=' + e0.y.toFixed(1) + ' w=' + e0.w + ' h=' + e0.h + ' hp=' + e0.hp);

console.log('\n=== 逐帧模拟 ===\n');

let frame = 0;
while (game.score === 0 && frame < 300 && game.lives > 0) {
  frame++;
  // 让玩家持续开火
  game.player.update(0.016, { move: () => ({}), fire: () => true }, game.bounds, game.bullets);
  // 游戏引擎 _update
  game._update(0.016);

  if (frame % 10 === 0) {
    console.log(`帧 ${frame}: 子弹数=${game.bullets.length} 敌机数=${game.enemies.length} 分数=${game.score}`);
    if (game.bullets.length && game.enemies.length) {
      const b = game.bullets[0];
      const e = game.enemies[0];
      console.log(`  子弹0: x=${b.x.toFixed(1)} y=${b.y.toFixed(1)}  敌机0: x=${e.x.toFixed(1)} y=${e.y.toFixed(1)}  碰撞=${aabb(b.hitbox(), e.hitbox())}`);
    }
  }
  if (game.enemies.length === 0) {
    console.log(`帧 ${frame}: 敌机全部消失！分数=${game.score}`);
    break;
  }
}

console.log(`\n最终: 帧 ${frame} 分数=${game.score} 存活敌机=${game.enemies.length} 子弹=${game.bullets.length}`);
if (game.score === 0) {
  console.error('✗ BUG: 敌机被清除了但分数为 0！');
  process.exit(1);
} else {
  console.log('✓ 分数正常累加');
}
