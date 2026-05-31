// TypeScript example — Code Scavenge test file

// Type aliases
type Vec3 = { x: number; y: number; z: number };
type ID = string | number;
type Callback<T> = (value: T) => void;

// Interfaces
interface Serializable {
  serialize(): string;
  deserialize(data: string): void;
}

interface Repository<T> {
  findById(id: ID): T | null;
  save(item: T): void;
  delete(id: ID): boolean;
}

// Enums
enum Direction { Up, Down, Left, Right }
const enum Status { Active = 'active', Inactive = 'inactive', Pending = 'pending' }

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mapRange(value: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return outMin + ((value - inMin) / (inMax - inMin)) * (outMax - outMin);
}

class Stack<T> {
  private items: T[] = [];

  push(item: T): void {
    this.items.push(item);
  }

  pop(): T | undefined {
    return this.items.pop();
  }

  peek(): T | undefined {
    return this.items.at(-1);
  }

  get size(): number {
    return this.items.length;
  }
}

class Timer {
  private elapsed = 0;
  private running = false;

  start(): void {
    this.running = true;
  }

  stop(): void {
    this.running = false;
  }

  tick(dt: number): void {
    if (this.running) this.elapsed += dt;
  }

  reset(): void {
    this.elapsed = 0;
    this.running = false;
  }
}
