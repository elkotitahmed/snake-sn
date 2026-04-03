import React, { useEffect, useRef, useState } from 'react';
import { Snake, Food, Point, Skin } from '../types';
import { WORLD_SIZE, SEGMENT_DISTANCE, SKINS } from '../constants';

interface GameCanvasProps {
  player: Snake;
  bots: Snake[];
  foods: Food[];
  onMouseMove: (e: React.MouseEvent | React.TouchEvent) => void;
}

const GameCanvas: React.FC<GameCanvasProps> = ({ player, bots, foods, onMouseMove }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Camera follow player
      const head = player.segments[0];
      const camX = dimensions.width / 2 - head.x;
      const camY = dimensions.height / 2 - head.y;

      ctx.save();
      ctx.translate(camX, camY);

      // Draw Grid
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 2;
      const gridSize = 100;
      for (let x = 0; x <= WORLD_SIZE; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, WORLD_SIZE);
        ctx.stroke();
      }
      for (let y = 0; y <= WORLD_SIZE; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(WORLD_SIZE, y);
        ctx.stroke();
      }

      // Draw World Border
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 10;
      ctx.strokeRect(0, 0, WORLD_SIZE, WORLD_SIZE);

      // Draw Food
      foods.forEach(food => {
        ctx.save();
        ctx.translate(food.x, food.y);
        
        ctx.fillStyle = food.color;
        ctx.shadowBlur = 15;
        ctx.shadowColor = food.color;

        if (food.type === 'magnet') {
          // Draw Magnet Icon
          ctx.beginPath();
          ctx.arc(0, 0, food.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('M', 0, 4);
        } else if (food.type === 'ghost') {
          // Draw Ghost Icon
          ctx.beginPath();
          ctx.arc(0, 0, food.size * 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = 'white';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'white';
          ctx.font = 'bold 10px sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('G', 0, 4);
        } else if (food.type === 'special') {
          // Draw Star/Diamond shape for special food
          ctx.beginPath();
          for (let i = 0; i < 5; i++) {
            const angle = (i * Math.PI * 2) / 5 - Math.PI / 2;
            const x = Math.cos(angle) * food.size * 1.5;
            const y = Math.sin(angle) * food.size * 1.5;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
        } else {
          // Normal food - Hexagon
          ctx.beginPath();
          for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI * 2) / 6;
            ctx.lineTo(Math.cos(angle) * food.size, Math.sin(angle) * food.size);
          }
          ctx.closePath();
          ctx.fill();
        }
        
        ctx.restore();
      });

      // Draw Snakes (Bots)
      bots.forEach(bot => drawSnake(ctx, bot));

      // Draw Player
      drawSnake(ctx, player);

      // Draw Magnet Aura if active
      if (player.activePowerUps.magnet && player.activePowerUps.magnet > Date.now()) {
        const head = player.segments[0];
        const shimmer = Math.sin(Date.now() / 200) * 10;
        const auraRadius = 250 + shimmer;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(head.x, head.y, auraRadius, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, auraRadius);
        gradient.addColorStop(0, 'rgba(0, 242, 254, 0)');
        gradient.addColorStop(0.8, 'rgba(0, 242, 254, 0.05)');
        gradient.addColorStop(1, 'rgba(0, 242, 254, 0.2)');
        ctx.fillStyle = gradient;
        ctx.fill();
        
        ctx.strokeStyle = 'rgba(0, 242, 254, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([15, 15]);
        ctx.lineDashOffset = -Date.now() / 50;
        ctx.stroke();
        ctx.restore();
      }

      ctx.restore();

      requestAnimationFrame(render);
    };

    const drawSnake = (ctx: CanvasRenderingContext2D, snake: Snake) => {
      if (snake.isDead) return;

      const segments = snake.segments;
      const radius = 12 + Math.min(snake.score / 100, 15);
      const skin = SKINS.find(s => s.id === snake.skinId) || SKINS[0];
      const isGhost = snake.activePowerUps.ghost && snake.activePowerUps.ghost > Date.now();

      // Draw Ghost Aura
      if (isGhost) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(segments[0].x, segments[0].y);
        for (let i = 1; i < segments.length; i++) {
          ctx.lineTo(segments[i].x, segments[i].y);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = radius * 2.8;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'white';
        ctx.stroke();
        ctx.restore();
      }

      // Draw Boost Aura
      if (snake.isBoosting) {
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(segments[0].x, segments[0].y);
        for (let i = 1; i < Math.min(segments.length, 10); i++) {
          ctx.lineTo(segments[i].x, segments[i].y);
        }
        ctx.strokeStyle = 'rgba(59, 130, 246, 0.3)';
        ctx.lineWidth = radius * 2.5;
        ctx.lineCap = 'round';
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#3b82f6';
        ctx.stroke();
        ctx.restore();
      }

      // Draw body segments with skin pattern
      for (let i = segments.length - 1; i >= 0; i--) {
        const segment = segments[i];
        
        ctx.save();
        ctx.translate(segment.x, segment.y);
        
        // Determine color based on pattern
        let color = skin.colors[0];
        if (skin.pattern === 'striped') {
          color = skin.colors[i % skin.colors.length];
        } else if (skin.pattern === 'dotted' && i % 3 === 0) {
          color = skin.colors[1] || skin.colors[0];
        } else if (skin.pattern === 'glow') {
          ctx.shadowBlur = 15;
          ctx.shadowColor = skin.colors[0];
        }

        if (isGhost) {
          ctx.globalAlpha = 0.4;
        }

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(0, 0, radius, 0, Math.PI * 2);
        ctx.fill();

        // Add some detail to segments
        if (i === 0) {
          // Head eyes
          const eyeRadius = radius * 0.3;
          const eyeOffset = radius * 0.5;
          ctx.rotate(snake.angle);
          
          ctx.fillStyle = 'white';
          ctx.beginPath();
          ctx.arc(eyeOffset, -eyeOffset * 0.8, eyeRadius, 0, Math.PI * 2);
          ctx.arc(eyeOffset, eyeOffset * 0.8, eyeRadius, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.fillStyle = 'black';
          ctx.beginPath();
          ctx.arc(eyeOffset + eyeRadius * 0.3, -eyeOffset * 0.8, eyeRadius * 0.5, 0, Math.PI * 2);
          ctx.arc(eyeOffset + eyeRadius * 0.3, eyeOffset * 0.8, eyeRadius * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        
        ctx.restore();
      }

      // Draw name
      ctx.fillStyle = 'white';
      ctx.font = 'bold 14px Outfit';
      ctx.textAlign = 'center';
      ctx.fillText(snake.name, segments[0].x, segments[0].y - radius - 10);
    };

    const animationId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationId);
  }, [player, bots, foods, dimensions]);

  return (
    <canvas
      ref={canvasRef}
      width={dimensions.width}
      height={dimensions.height}
      onMouseMove={onMouseMove}
      onTouchMove={onMouseMove}
      className="block cursor-none"
    />
  );
};

export default GameCanvas;
