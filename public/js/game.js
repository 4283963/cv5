// 游戏引擎：渲染循环、实体管理、敌机生成、碰撞检测、关卡难度
import { Player, Enemy, Bullet, Particle, FloatingText, Star, explode, aabb, ENEMY_CONFIG } from './entities.js';

const W = 480;
const H = 720;
const STAR_COUNT = 90;

export class Game {
  constructor(canvas, input, callbacks = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.input = input;
    this.callbacks = callbacks;

    this.bounds = { w: W, h: H };
    this.state = 'idle'; // idle | playing | paused | over
    this.last = 0;
    this.accumulator = 0;

    this.stars = Array.from({ length: STAR_COUNT }, () => new Star(W, H));
    this.shake = 0;
    this.shakeMag = 0;

    this._loop = this._loop.bind(this);
    this._raf = null;
  }

  reset() {
    this.player = new Player(W / 2, H - 90);
    this.bullets = [];
    this.enemyBullets = [];
    this.enemies = [];
    this.particles = [];
    this.texts = [];
    this.score = 0;
    this.wave = 1;
    this.lives = 3;
    this.killsThisWave = 0;
    this.spawnTimer = 1.2;
    this.shake = 0;
    this.shakeMag = 0;
    this._emitHud();
  }

  start() {
    this.reset();
    this.state = 'playing';
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    if (this.callbacks.onPause) this.callbacks.onPause();
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this.last = performance.now();
    this._raf = requestAnimationFrame(this._loop);
    if (this.callbacks.onResume) this.callbacks.onResume();
  }

  stop() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._raf = null;
    this.state = 'over';
  }

  _loop(ts) {
    if (this.state !== 'playing') return;
    let dt = (ts - this.last) / 1000;
    this.last = ts;
    if (dt > 0.05) dt = 0.05; // 防止切后台后的大跳变
    this._update(dt);
    this._render();
    this._raf = requestAnimationFrame(this._loop);
  }

  _update(dt) {
    // 星空
    for (const s of this.stars) s.update(dt);

    // 玩家
    this.player.update(dt, this.input, this.bounds, this.bullets);

    // 生成敌机
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this._spawnWave();
      const interval = Math.max(0.4, 1.5 - this.wave * 0.08);
      this.spawnTimer = interval * (0.7 + Math.random() * 0.6);
    }

    // 敌机
    for (const e of this.enemies) {
      e.update(dt, this.bounds, this.enemyBullets, this.player);
      if (e.y > H + 40) e.dead = true;
    }

    // 子弹
    for (const b of this.bullets) b.update(dt, this.bounds);
    for (const b of this.enemyBullets) b.update(dt, this.bounds);

    // 碰撞：玩家子弹 vs 敌机
    for (const b of this.bullets) {
      if (b.dead) continue;
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (aabb(b.hitbox(), e.hitbox())) {
          b.dead = true;
          e.hit(1);
          if (e.dead) {
            this.score += e.points;
            this.killsThisWave++;
            explode(this.particles, e.centerX(), e.centerY(), '#ff8c2a', 16);
            this.texts.push(new FloatingText(e.centerX(), e.centerY(), `+${e.points}`, '#ffe600'));
            this._addShake(0.12, 3);
            this._emitHud();
            this._checkWave();
          } else {
            explode(this.particles, b.x, b.y, '#00f0ff', 5);
          }
          break;
        }
      }
    }

    // 碰撞：敌机子弹 vs 玩家
    if (this.player.invincible <= 0) {
      const pb = this.player.hitbox();
      for (const b of this.enemyBullets) {
        if (b.dead) continue;
        if (aabb(b.hitbox(), pb)) {
          b.dead = true;
          this._hitPlayer();
          break;
        }
      }
    }

    // 碰撞：敌机撞击玩家
    if (this.player.invincible <= 0 && !this.player.dead) {
      const pb = this.player.hitbox();
      for (const e of this.enemies) {
        if (e.dead) continue;
        if (aabb(e.hitbox(), pb)) {
          e.dead = true;
          this.score += e.points;
          this.killsThisWave++;
          explode(this.particles, e.centerX(), e.centerY(), '#ff2d95', 18);
          this._emitHud();
          this._checkWave();
          this._hitPlayer();
          break;
        }
      }
    }

    // 清理
    this.bullets = this.bullets.filter((b) => !b.dead);
    this.enemyBullets = this.enemyBullets.filter((b) => !b.dead);
    this.enemies = this.enemies.filter((e) => !e.dead);

    // 粒子与文字
    for (const p of this.particles) p.update(dt);
    for (const t of this.texts) t.update(dt);
    this.particles = this.particles.filter((p) => !p.dead);
    this.texts = this.texts.filter((t) => !t.dead);

    if (this.shake > 0) this.shake -= dt;
  }

  _spawnWave() {
    // 按关卡加权选择敌机类型
    const weights = {
      grunt: Math.max(2, 8 - this.wave),
      diver: Math.min(6, 1 + this.wave * 0.8),
      shooter: this.wave >= 2 ? Math.min(5, this.wave * 0.7) : 0,
      tank: this.wave >= 4 ? Math.min(3, (this.wave - 3) * 0.8) : 0,
    };
    const types = Object.keys(weights);
    const total = types.reduce((s, k) => s + weights[k], 0);
    let r = Math.random() * total;
    let type = 'grunt';
    for (const k of types) {
      r -= weights[k];
      if (r <= 0) { type = k; break; }
    }
    const margin = 30;
    const x = margin + Math.random() * (W - margin * 2);
    this.enemies.push(new Enemy(type, x, -20, this.wave));

    // 高关卡偶发编队
    if (this.wave >= 3 && Math.random() < 0.25) {
      const gap = 44;
      for (let i = 1; i <= 2; i++) {
        const nx = Math.max(margin, Math.min(W - margin, x + i * gap * (Math.random() < 0.5 ? -1 : 1)));
        this.enemies.push(new Enemy('grunt', nx, -20 - i * 30, this.wave));
      }
    }
  }

  _checkWave() {
    const needed = 8 + this.wave * 2;
    if (this.killsThisWave >= needed) {
      this.wave++;
      this.killsThisWave = 0;
      this.texts.push(new FloatingText(W / 2, H / 2, `WAVE ${this.wave}`, '#00f0ff'));
      this._addShake(0.2, 4);
      this._emitHud();
    }
  }

  _hitPlayer() {
    this.lives--;
    this.player.invincible = 1.6;
    explode(this.particles, this.player.centerX(), this.player.centerY(), '#00f0ff', 22);
    this._addShake(0.3, 8);
    this._emitHud();
    if (this.lives <= 0) {
      this.player.dead = true;
      this.stop();
      if (this.callbacks.onGameOver) this.callbacks.onGameOver(this.score);
    }
  }

  _addShake(time, mag) {
    this.shake = Math.max(this.shake, time);
    this.shakeMag = Math.max(this.shakeMag, mag);
  }

  _emitHud() {
    if (this.callbacks.onHud) this.callbacks.onHud(this.score, this.wave, this.lives);
  }

  _render() {
    const ctx = this.ctx;
    ctx.save();
    // 屏幕抖动
    if (this.shake > 0) {
      const m = this.shakeMag * (this.shake > 0 ? 1 : 0);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    // 背景
    ctx.fillStyle = '#02000a';
    ctx.fillRect(0, 0, W, H);
    // 星空
    for (const s of this.stars) s.draw(ctx);
    // 实体
    for (const e of this.enemies) e.draw(ctx);
    for (const b of this.bullets) b.draw(ctx);
    for (const b of this.enemyBullets) b.draw(ctx);
    if (this.player && !this.player.dead) this.player.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const t of this.texts) t.draw(ctx);
    ctx.restore();
  }
}
