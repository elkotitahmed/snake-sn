export interface Point {
  x: number;
  y: number;
}

export type PowerUpType = 'magnet' | 'multiplier' | 'ghost';

export interface PowerUp {
  id: string;
  x: number;
  y: number;
  type: PowerUpType;
  color: string;
  expiresAt: number;
}

export type SkinPattern = 'solid' | 'striped' | 'dotted' | 'glow';

export interface Skin {
  id: string;
  name: string;
  colors: string[];
  pattern: SkinPattern;
}

export interface Snake {
  id: string;
  name: string;
  segments: Point[];
  angle: number;
  targetAngle: number;
  speed: number;
  color: string;
  skinId: string;
  score: number;
  isDead: boolean;
  isBoosting: boolean;
  activePowerUps: {
    [key in PowerUpType]?: number; // timestamp when it expires
  };
}

export interface Food {
  id: string;
  x: number;
  y: number;
  value: number;
  color: string;
  size: number;
  type: 'normal' | 'special' | PowerUpType;
  velocity?: Point; // For magnet effect
}

export interface GameState {
  player: Snake;
  bots: Snake[];
  foods: Food[];
  worldSize: { width: number; height: number };
  camera: Point;
}
