// 游戏实体：玩家、敌机、子弹、粒子、浮动文字、星空
// 使用像素图（字符数组）绘制复古像素艺术，霓虹配色

const PALETTES = {
  player: { C: '#00f0ff', Y: '#ffe600', M: '#ff2d95', E: '#ff8c2a' },
  grunt: { R: '#ff2d95', W: '#ffffff' },
  diver: { G: '#39ff14', W: '#ffffff' },
  shooter: { P: '#b14dff', W: '#ffffff' },
  tank: { O: '#ff8c2a', D: '#7a4a00', W: '#ffe600' },
};

// 玩家飞船像素图（7列 x 8行，每格 4px => 28x32）
const PLAYER_MAP = [
  '..CCC..',
  '.CCYCC.',
  'CCCYCCC',
  'CMCCCMC',
  '.MCCCM.',
  '..CCC..',
  '.EEEE..',
  '...E...',
];

const ENEMY_MAPS = {
  grunt: [
    '...R...',
    '..RRR..',
    '.RRWRR.',
    'RRRRRRR',
    '.RRRRR.',
    '.R...R.',
  ],
  diver: [
    'G.....G',
    'GG...GG',
    '.GWWWG.',
    '.GGGGG.',
    '..GGG..',
    '...G...',
  ],
  shooter: [
    '.PPPPP.',
    'PWWPPWP',
    'PPPPPPP',
    '.PPPPP.',
    '..P.P..',
  ],
  tank: [
    'OOOOOOO',
    'OWWOWWO',
    'OOODDOO',
    'OODOOOO',
    'OOOOOOO',
    '.OOOOO.',
  ],
};

function drawPixels(ctx, map, palette, cell, x, y, glow) {
  const ox = Math.round(x);
  const oy = Math.round(y);
  if (glow) {
    ctx.shadowColor = glow;
    ctx.shadowBlur = 8;
  }
  for (let row = 0; row < map.length; row++) {
    const line = map[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      if (ch === '.' || ch === ' ') continue;
      const color = palette[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(ox + col * cell, oy + row * cell, cell, cell);
    }
  }
  if (glow) ctx.shadowBlur = 0;
}

function pixelSize(map, cell) {
  const w = map[0].length * cell;
  const h = map.length * cell;
  return { w, h };
}

// 工具：AABB 相交
export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export class Star {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.reset(true);
  }
  reset(initial) {
    this.x = Math.random() * this.width;
    this.y = initial ? Math.random() * this.height : -2;
    this.z = Math.random(); // 视差层 0..1
    this.size = this.z < 0.3 ? 1 : 2;
    this.speed = 30 + this.z * 120;
    this.bright = 0.3 + this.z * 0.7;
  }
  update(dt) {
    this.y += this.speed * dt;
    if (this.y > this.height) this.reset(false);
  }
  draw(ctx) {
    ctx.globalAlpha = this.bright;
    ctx.fillStyle = this.z > 0.7 ? '#bff7ff' : '#7fa8d8';
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

export class Player {
  constructor(x, y) {
    this.cell = 4;
    const { w, h } = pixelSize(PLAYER_MAP, this.cell);
    this.w = w;
    this.h = h;
    this.x = x - w / 2;
    this.y = y - h / 2;
    this.speed = 300;
    this.cooldown = 0;
    this.fireRate = 0.16;
    this.invincible = 1.2;
    this.dead = false;
    this.engineFlick = 0;
    this.powerup = 0;
  }
  centerX() { return this.x + this.w / 2; }
  centerY() { return this.y + this.h / 2; }
  hitbox() {
    const pad = 4;
    return { x: this.x + pad, y: this.y + pad, w: this.w - pad * 2, h: this.h - pad * 2 };
  }
  isPoweredUp() {
    return this.powerup > 0;
  }
  activatePowerup(duration = 5) {
    this.powerup = Math.max(this.powerup, duration);
  }
  update(dt, input, bounds, bullets) {
    const m = input.move();
    let vx = 0, vy = 0;
    if (m.left) vx -= 1;
    if (m.right) vx += 1;
    if (m.up) vy -= 1;
    if (m.down) vy += 1;
    if (vx !== 0 && vy !== 0) { vx *= 0.7071; vy *= 0.7071; }
    this.x += vx * this.speed * dt;
    this.y += vy * this.speed * dt;
    this.x = Math.max(4, Math.min(bounds.w - this.w - 4, this.x));
    this.y = Math.max(bounds.h * 0.35, Math.min(bounds.h - this.h - 4, this.y));

    this.cooldown -= dt;
    if (input.fire() && this.cooldown <= 0) {
      if (this.powerup > 0) {
        this._fireSpread(bullets);
      } else {
        this._fireNormal(bullets);
      }
      this.cooldown = this.fireRate;
    }
    if (this.invincible > 0) this.invincible -= dt;
    if (this.powerup > 0) this.powerup -= dt;
    this.engineFlick = (this.engineFlick + dt * 20) % (Math.PI * 2);
  }
  _fireNormal(bullets) {
    bullets.push(new Bullet(this.centerX() - 7, this.y, 0, -560, 'player'));
    bullets.push(new Bullet(this.centerX() + 2, this.y, 0, -560, 'player'));
  }
  _fireSpread(bullets) {
    const speed = 560;
    const angles = [-0.3, 0, 0.3];
    for (const a of angles) {
      const vx = Math.sin(a) * speed;
      const vy = -Math.cos(a) * speed;
      bullets.push(new Bullet(this.centerX() - 2, this.y, vx, vy, 'player'));
    }
  }
  draw(ctx) {
    if (this.invincible > 0 && Math.floor(this.invincible * 12) % 2 === 0) return;

    if (this.powerup > 0) {
      const pulse = 0.6 + Math.sin(this.powerup * 12) * 0.4;
      ctx.save();
      ctx.globalAlpha = 0.5 * pulse;
      ctx.shadowColor = '#ffe600';
      ctx.shadowBlur = 20;
      ctx.strokeStyle = '#ffe600';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.centerX(), this.centerY(), this.w * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 引擎尾焰
    const flame = 4 + Math.sin(this.engineFlick) * 3;
    ctx.fillStyle = '#ff8c2a';
    ctx.globalAlpha = 0.9;
    ctx.fillRect(this.x + this.w / 2 - 2, this.y + this.h - 2, 4, flame);
    ctx.fillStyle = '#ffe600';
    ctx.fillRect(this.x + this.w / 2 - 1, this.y + this.h - 2, 2, flame * 0.6);
    ctx.globalAlpha = 1;
    const shipGlow = this.powerup > 0 ? '#ffe600' : '#00f0ff';
    drawPixels(ctx, PLAYER_MAP, PALETTES.player, this.cell, this.x, this.y, shipGlow);
  }
}

export class Enemy {
  constructor(type, x, y, wave) {
    this.type = type;
    this.cell = 4;
    const map = ENEMY_MAPS[type];
    const { w, h } = pixelSize(map, this.cell);
    this.w = w;
    this.h = h;
    this.x = x - w / 2;
    this.y = y;
    this.dead = false;
    this.t = 0;
    this.baseX = this.x;
    this.shootTimer = 1 + Math.random() * 2;
    const waveBoost = 1 + (wave - 1) * 0.12;
    const cfg = ENEMY_CONFIG[type];
    this.hp = cfg.hp;
    this.points = cfg.points;
    this.speed = cfg.speed * waveBoost;
    this.canShoot = cfg.canShoot;
    this.shootChance = cfg.shootChance;
    this.pattern = cfg.pattern;
  }
  centerX() { return this.x + this.w / 2; }
  centerY() { return this.y + this.h / 2; }
  hitbox() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  update(dt, bounds, enemyBullets, player) {
    this.t += dt;
    this.y += this.speed * dt;
    if (this.pattern === 'zig') {
      this.x = this.baseX + Math.sin(this.t * 3) * 40;
    } else if (this.pattern === 'drift') {
      this.x = this.baseX + Math.sin(this.t * 1.2) * 70;
    }
    if (this.canShoot) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0 && this.y > 0 && this.y < bounds.h * 0.6) {
        const dx = player ? player.centerX() - this.centerX() : 0;
        const dy = player ? player.centerY() - this.centerY() : 1;
        const len = Math.hypot(dx, dy) || 1;
        const sp = 220;
        enemyBullets.push(new Bullet(this.centerX() - 2, this.y + this.h, (dx / len) * sp, (dy / len) * sp, 'enemy'));
        this.shootTimer = 1.6 + Math.random() * 1.8 - this.shootChance;
      }
    }
  }
  hit(dmg) {
    this.hp -= dmg;
    if (this.hp <= 0) this.dead = true;
  }
  draw(ctx) {
    const glow = { grunt: '#ff2d95', diver: '#39ff14', shooter: '#b14dff', tank: '#ff8c2a' }[this.type];
    drawPixels(ctx, ENEMY_MAPS[this.type], PALETTES[this.type], this.cell, this.x, this.y, glow);
  }
}

export const ENEMY_CONFIG = {
  grunt: { hp: 1, points: 100, speed: 90, canShoot: false, pattern: 'straight' },
  diver: { hp: 1, points: 150, speed: 150, canShoot: false, pattern: 'zig' },
  shooter: { hp: 2, points: 220, speed: 70, canShoot: true, shootChance: 0.4, pattern: 'straight' },
  tank: { hp: 4, points: 400, speed: 55, canShoot: true, shootChance: 0.2, pattern: 'drift' },
};

export class Bullet {
  constructor(x, y, vx, vy, owner) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.owner = owner;
    this.w = owner === 'player' ? 5 : 5;
    this.h = owner === 'player' ? 14 : 5;
    this.dead = false;
    this.trail = [];
  }
  hitbox() {
    if (this.owner === 'player') {
      return { x: this.x - 1, y: this.y, w: this.w + 2, h: this.h };
    }
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }
  update(dt, bounds) {
    this.trail.push({ x: this.x, y: this.y });
    if (this.trail.length > 5) this.trail.shift();
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    if (this.y < -20 || this.y > bounds.h + 20 || this.x < -20 || this.x > bounds.w + 20) this.dead = true;
  }
  draw(ctx) {
    const color = this.owner === 'player' ? '#00f0ff' : '#ff2d95';
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    // 拖尾
    for (let i = 0; i < this.trail.length; i++) {
      ctx.globalAlpha = (i / this.trail.length) * 0.4;
      ctx.fillStyle = color;
      ctx.fillRect(this.trail[i].x, this.trail[i].y, this.w, this.h);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#ffffff';
    if (this.owner === 'player') {
      ctx.fillRect(this.x, this.y, this.w, this.h);
    } else {
      ctx.beginPath();
      ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = color;
    if (this.owner === 'player') ctx.fillRect(this.x, this.y, this.w, this.h);
    else { ctx.beginPath(); ctx.arc(this.x + this.w / 2, this.y + this.h / 2, this.w / 2 - 1, 0, Math.PI * 2); ctx.fill(); }
    ctx.shadowBlur = 0;
  }
}

export class StarPowerUp {
  constructor(x, y) {
    this.x = x - 10;
    this.y = y - 10;
    this.w = 20;
    this.h = 20;
    this.vy = 80;
    this.t = 0;
    this.dead = false;
    this.collected = false;
  }
  hitbox() {
    return { x: this.x + 3, y: this.y + 3, w: this.w - 6, h: this.h - 6 };
  }
  update(dt, bounds) {
    this.t += dt;
    this.y += this.vy * dt;
    if (this.y > bounds.h + 30) this.dead = true;
  }
  draw(ctx) {
    const flash = Math.sin(this.t * 10) * 0.4 + 0.6;
    ctx.save();
    ctx.globalAlpha = flash;
    ctx.shadowColor = '#ffe600';
    ctx.shadowBlur = 16;
    ctx.translate(this.x + this.w / 2, this.y + this.h / 2);
    ctx.rotate(this.t * 2);
    const s = this.w / 2;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 === 0 ? s : s * 0.45;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = '#ffe600';
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, 0, s * 0.25, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export class Particle {
  constructor(x, y, color) {
    this.x = x;
    this.y = y;
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 180;
    this.vx = Math.cos(a) * sp;
    this.vy = Math.sin(a) * sp;
    this.life = 0.4 + Math.random() * 0.5;
    this.max = this.life;
    this.size = 2 + Math.random() * 3;
    this.color = color;
    this.dead = false;
  }
  update(dt) {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vx *= 0.92;
    this.vy *= 0.92;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x, this.y, this.size, this.size);
    ctx.globalAlpha = 1;
  }
}

export class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 0.9;
    this.max = 0.9;
    this.dead = false;
  }
  update(dt) {
    this.y -= 40 * dt;
    this.life -= dt;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    ctx.globalAlpha = Math.max(0, this.life / this.max);
    ctx.fillStyle = this.color;
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.text, this.x, this.y);
    ctx.globalAlpha = 1;
  }
}

// 爆炸：生成一组粒子
export function explode(particles, x, y, color, count = 14) {
  for (let i = 0; i < count; i++) particles.push(new Particle(x, y, color));
}
