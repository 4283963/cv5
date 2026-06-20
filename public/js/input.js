// 键盘输入管理器：统一管理按键状态，支持 WASD / 方向键 / 空格 / P
const PREVENT_DEFAULT = new Set([
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space',
]);

export class Input {
  constructor() {
    this.keys = new Set();
    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onBlur = this._onBlur.bind(this);
  }

  attach() {
    window.addEventListener('keydown', this._onKeyDown, { passive: false });
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  _isTyping() {
    const el = document.activeElement;
    return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
  }

  _onKeyDown(e) {
    if (this._isTyping()) return;
    if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
    this.keys.add(e.code);
  }

  _onKeyUp(e) {
    this.keys.delete(e.code);
  }

  _onBlur() {
    this.keys.clear();
  }

  isDown(code) {
    return this.keys.has(code);
  }

  // 供移动端虚拟手柄使用：注入/移除虚拟按键
  setVirtual(code, down) {
    if (down) this.keys.add(code);
    else this.keys.delete(code);
  }

  move() {
    return {
      left: this.isDown('ArrowLeft') || this.isDown('KeyA'),
      right: this.isDown('ArrowRight') || this.isDown('KeyD'),
      up: this.isDown('ArrowUp') || this.isDown('KeyW'),
      down: this.isDown('ArrowDown') || this.isDown('KeyS'),
    };
  }

  fire() {
    return this.isDown('Space');
  }
}
