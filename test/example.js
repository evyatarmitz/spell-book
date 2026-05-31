// JavaScript example — Code Scavenge test file

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

const normalize = (vec) => {
  const len = Math.hypot(vec.x, vec.y);
  return { x: vec.x / len, y: vec.y / len };
};

class Vector2 {
  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  add(other) {
    return new Vector2(this.x + other.x, this.y + other.y);
  }

  scale(factor) {
    return new Vector2(this.x * factor, this.y * factor);
  }

  dot(other) {
    return this.x * other.x + this.y * other.y;
  }

  length() {
    return Math.hypot(this.x, this.y);
  }
}

class EventBus {
  constructor() {
    this._handlers = {};
  }

  on(event, fn) {
    (this._handlers[event] ||= []).push(fn);
  }

  emit(event, data) {
    (this._handlers[event] || []).forEach(fn => fn(data));
  }

  off(event, fn) {
    this._handlers[event] = (this._handlers[event] || []).filter(h => h !== fn);
  }
}
