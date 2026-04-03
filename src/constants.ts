import { Skin } from './types';

export const SKINS: Skin[] = [
  { id: 'classic-blue', name: 'Classic Blue', colors: ['#3b82f6'], pattern: 'solid' },
  { id: 'classic-red', name: 'Classic Red', colors: ['#ef4444'], pattern: 'solid' },
  { id: 'classic-green', name: 'Classic Green', colors: ['#22c55e'], pattern: 'solid' },
  { id: 'classic-yellow', name: 'Classic Yellow', colors: ['#eab308'], pattern: 'solid' },
  { id: 'tiger', name: 'Tiger', colors: ['#f97316', '#000000'], pattern: 'striped' },
  { id: 'zebra', name: 'Zebra', colors: ['#ffffff', '#000000'], pattern: 'striped' },
  { id: 'neon', name: 'Neon Pulse', colors: ['#00f2fe', '#f9d423'], pattern: 'glow' },
  { id: 'galaxy', name: 'Galaxy', colors: ['#a18cd1', '#fbc2eb'], pattern: 'dotted' },
  { id: 'lava', name: 'Lava', colors: ['#ff0844', '#ffb199'], pattern: 'striped' },
  { id: 'forest', name: 'Forest', colors: ['#134e4a', '#2dd4bf'], pattern: 'striped' },
];

export const WORLD_SIZE = 4000;

export const INITIAL_SNAKE_LENGTH = 20;
export const SEGMENT_DISTANCE = 5;
export const BASE_SPEED = 3;
export const BOOST_SPEED = 6;
export const TURN_SPEED = 0.12;
export const FOOD_COUNT = 600;
export const BOT_COUNT = 12;
export const POWERUP_SPAWN_CHANCE = 0.005;
export const MAGNET_RADIUS = 250;
export const MAGNET_STRENGTH = 8;

export const COLORS = [
  '#FF5733', '#33FF57', '#3357FF', '#F333FF', '#FF33A1',
  '#33FFF3', '#F3FF33', '#FF8C33', '#8C33FF', '#33FF8C',
  '#00d2ff', '#3a7bd5', '#f2994a', '#f2c94c'
];

export const POWERUP_COLORS = {
  magnet: '#00f2fe',
  multiplier: '#f9d423',
  ghost: '#a18cd1'
};

export const BOT_NAMES = [
  'SlitherMaster', 'SnakeKing', 'Venom', 'Cobra', 'Python',
  'Mamba', 'Asp', 'Viper', 'Naga', 'Basilisk',
  'Serpent', 'Crawler', 'Slider', 'Glider', 'Striker'
];
