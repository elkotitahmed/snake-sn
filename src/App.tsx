import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Play, Skull, Zap, User, LogIn, LogOut } from 'lucide-react';
import { signInWithPopup, signOut, onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from './firebase';
import { Snake, Food, Point } from './types';
import { getBotDecisions } from './services/aiService';
import { 
  WORLD_SIZE, 
  INITIAL_SNAKE_LENGTH, 
  SEGMENT_DISTANCE, 
  BASE_SPEED, 
  BOOST_SPEED, 
  TURN_SPEED, 
  FOOD_COUNT, 
  BOT_COUNT, 
  COLORS, 
  BOT_NAMES,
  SKINS
} from './constants';
import GameCanvas from './components/GameCanvas';

const createSnake = (id: string, name: string, x: number, y: number, color: string, skinId: string = 'classic-blue'): Snake => {
  const segments: Point[] = [];
  for (let i = 0; i < INITIAL_SNAKE_LENGTH; i++) {
    segments.push({ x: x - i * SEGMENT_DISTANCE, y });
  }
  return {
    id,
    name,
    segments,
    angle: 0,
    targetAngle: 0,
    speed: BASE_SPEED,
    color,
    skinId,
    score: 0,
    isDead: false,
    isBoosting: false,
    activePowerUps: {}
  };
};

const createFood = (id: string): Food => {
  const rand = Math.random();
  let type: Food['type'] = 'normal';
  let color = COLORS[Math.floor(Math.random() * COLORS.length)];
  let value = 1;
  let size = 3 + Math.random() * 4;

  if (rand < 0.02) {
    type = 'magnet';
    color = '#00f2fe';
    value = 5;
    size = 8;
  } else if (rand < 0.03) {
    type = 'ghost';
    color = '#ffffff';
    value = 5;
    size = 8;
  } else if (rand < 0.1) {
    type = 'special';
    value = 3;
    size = 6;
  }

  return {
    id,
    x: Math.random() * WORLD_SIZE,
    y: Math.random() * WORLD_SIZE,
    value,
    color,
    size,
    type
  };
};

export default function App() {
  const [gameState, setGameState] = useState<'start' | 'playing' | 'gameover'>('start');
  const [player, setPlayer] = useState<Snake>(createSnake('player', 'You', WORLD_SIZE / 2, WORLD_SIZE / 2, '#3b82f6'));
  const [bots, setBots] = useState<Snake[]>([]);
  const [foods, setFoods] = useState<Food[]>([]);
  const [playerName, setPlayerName] = useState('');
  const [selectedSkinId, setSelectedSkinId] = useState('classic-blue');
  const [highScore, setHighScore] = useState(0);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Use refs for high-frequency updates to avoid React state lag
  const gameLoopRef = useRef<number>(0);
  const stateRef = useRef({
    player: createSnake('player', 'You', WORLD_SIZE / 2, WORLD_SIZE / 2, '#3b82f6'),
    bots: [] as Snake[],
    foods: [] as Food[],
    lastUpdate: 0
  });

  const initGame = () => {
    const newPlayer = createSnake('player', playerName || 'Snake-SN', WORLD_SIZE / 2, WORLD_SIZE / 2, '#3b82f6', selectedSkinId);
    const newBots: Snake[] = [];
    for (let i = 0; i < BOT_COUNT; i++) {
      const botSkin = SKINS[Math.floor(Math.random() * SKINS.length)];
      newBots.push(createSnake(
        `bot-${i}`,
        BOT_NAMES[i % BOT_NAMES.length],
        Math.random() * WORLD_SIZE,
        Math.random() * WORLD_SIZE,
        botSkin.colors[0],
        botSkin.id
      ));
    }
    const newFoods: Food[] = [];
    for (let i = 0; i < FOOD_COUNT; i++) {
      newFoods.push(createFood(`food-${i}`));
    }
    
    stateRef.current = {
      player: newPlayer,
      bots: newBots,
      foods: newFoods,
      lastUpdate: performance.now()
    };
    
    setPlayer(newPlayer);
    setBots(newBots);
    setFoods(newFoods);
    setGameState('playing');
  };

  // AI Bot Behavior - نسخة محسنة للأداء
  useEffect(() => {
    if (gameState !== 'playing') return;

    let abortController = new AbortController();

    const updateBotAI = async () => {
      if (gameState !== 'playing') return;
      
      const state = stateRef.current;
      if (!state.player.segments.length || state.bots.length === 0) return;
      
      const playerPos = state.player.segments[0];
      // إرسال 3 بوتات فقط (بدلاً من 5) لتقليل الحمل
      const botData = state.bots.slice(0, 3).map(b => ({
        id: b.id,
        x: b.segments[0].x,
        y: b.segments[0].y,
        angle: b.angle,
        score: b.score
      }));
      // إرسال 5 حبات طعام فقط (بدلاً من 10)
      const foodData = state.foods.slice(0, 5).map(f => ({
        x: f.x,
        y: f.y,
        value: f.value
      }));

      try {
        const decisions = await getBotDecisions(
          playerPos, 
          botData, 
          foodData, 
          WORLD_SIZE,
          { signal: abortController.signal }  // دعم إلغاء الطلب
        );
        
        // تطبيق القرارات على البوتات
        stateRef.current.bots = stateRef.current.bots.map(bot => {
          if (decisions[bot.id]) {
            return {
              ...bot,
              targetAngle: decisions[bot.id].angle,
              isBoosting: decisions[bot.id].boost && bot.score > 20
            };
          }
          return bot;
        });
        
        // تحديث الحالة للـ UI بشكل غير متكرر (كل طلب AI فقط)
        setBots([...stateRef.current.bots]);
        
      } catch (error) {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('AI update failed, using random movement for bots:', error);
          // حركة عشوائية كـ fallback للبوتات التي فشلت
          stateRef.current.bots = stateRef.current.bots.map(bot => ({
            ...bot,
            targetAngle: bot.targetAngle + (Math.random() - 0.5) * 0.5,
            isBoosting: false
          }));
          setBots([...stateRef.current.bots]);
        }
      }
    };

    // زيادة الفاصل الزمني إلى 10 ثوانٍ (كان 3 ثوانٍ)
    const aiInterval = setInterval(() => {
      updateBotAI().catch(err => {
        if (err.name !== 'AbortError') {
          console.error('AI interval error:', err);
        }
      });
    }, 10000); // ← 10000 مللي ثانية = 10 ثوانٍ

    return () => {
      clearInterval(aiInterval);
      abortController.abort();
    };
  }, [gameState]);

  // Auth listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        // Load user data from Firestore
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
          const data = userDoc.data();
          setHighScore(data.highScore || 0);
          setSelectedSkinId(data.selectedSkinId || 'classic-blue');
          setPlayerName(data.displayName || firebaseUser.displayName || '');
        } else {
          // Create initial user doc
          await setDoc(userDocRef, {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || '',
            highScore: 0,
            selectedSkinId: 'classic-blue',
            updatedAt: serverTimestamp()
          });
        }
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setHighScore(0);
      setPlayerName('');
      setSelectedSkinId('classic-blue');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (gameState !== 'playing') return;

    let clientX, clientY;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const angle = Math.atan2(dy, dx);

    stateRef.current.player.targetAngle = angle;
  }, [gameState]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.code === 'Space') {
      stateRef.current.player.isBoosting = true;
    }
  };

  const handleKeyUp = (e: React.KeyboardEvent) => {
    if (e.code === 'Space') {
      stateRef.current.player.isBoosting = false;
    }
  };

  const updateSnake = (snake: Snake, targetAngle: number, isBoosting: boolean): Snake => {
    if (snake.isDead) return snake;

    let angleDiff = targetAngle - snake.angle;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
    
    const newAngle = snake.angle + angleDiff * TURN_SPEED;
    const speed = isBoosting && snake.score > 10 ? BOOST_SPEED : BASE_SPEED;
    
    const head = snake.segments[0];
    const newHead = {
      x: head.x + Math.cos(newAngle) * speed,
      y: head.y + Math.sin(newAngle) * speed
    };

    if (newHead.x < 0 || newHead.x > WORLD_SIZE || newHead.y < 0 || newHead.y > WORLD_SIZE) {
      return { ...snake, isDead: true };
    }

    const newSegments = [newHead];
    for (let i = 0; i < snake.segments.length - 1; i++) {
      const current = newSegments[i];
      const next = snake.segments[i];
      const dx = next.x - current.x;
      const dy = next.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist > SEGMENT_DISTANCE) {
        const ratio = SEGMENT_DISTANCE / dist;
        newSegments.push({
          x: current.x + dx * ratio,
          y: current.y + dy * ratio
        });
      } else {
        newSegments.push(next);
      }
    }

    const targetLength = INITIAL_SNAKE_LENGTH + Math.floor(snake.score / 5);
    while (newSegments.length > targetLength) {
      newSegments.pop();
    }

    return {
      ...snake,
      angle: newAngle,
      segments: newSegments,
      speed,
      isBoosting: isBoosting && snake.score > 10,
      score: isBoosting && snake.score > 10 ? snake.score - 0.1 : snake.score
    };
  };

  useEffect(() => {
    if (gameState !== 'playing') return;

    const loop = (time: number) => {
      const state = stateRef.current;
      
      // Update Player
      state.player = updateSnake(state.player, state.player.targetAngle, state.player.isBoosting);
      if (state.player.isDead) {
        setGameState('gameover');
        return;
      }

      // Update Bots
      state.bots = state.bots.map(bot => {
        let targetAngle = bot.targetAngle;
        // Keep some randomness for bots not controlled by AI or as fallback
        if (Math.random() < 0.01) {
          targetAngle = Math.random() * Math.PI * 2;
        }
        return updateSnake(bot, targetAngle, bot.isBoosting);
      });

      // Magnet Effect Logic
      const isMagnetActive = state.player.activePowerUps.magnet && state.player.activePowerUps.magnet > Date.now();
      const playerHead = state.player.segments[0];

      // Update Foods & Eating
      state.foods = state.foods.map(food => {
        if (isMagnetActive) {
          const dx = playerHead.x - food.x;
          const dy = playerHead.y - food.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 250) {
            const angle = Math.atan2(dy, dx);
            return {
              ...food,
              x: food.x + Math.cos(angle) * 8,
              y: food.y + Math.sin(angle) * 8
            };
          }
        }
        return food;
      }).filter(food => {
        const dx = food.x - playerHead.x;
        const dy = food.y - playerHead.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const radius = 12 + Math.min(state.player.score / 100, 15);
        
        if (dist < radius + food.size) {
          state.player.score += food.value;
          if (food.type === 'magnet') {
            state.player.activePowerUps.magnet = Date.now() + 10000; // 10 seconds
          } else if (food.type === 'ghost') {
            state.player.activePowerUps.ghost = Date.now() + 8000; // 8 seconds
          }
          return false;
        }
        return true;
      });

      // Respawn Food
      while (state.foods.length < FOOD_COUNT) {
        state.foods.push(createFood(`food-${Date.now()}-${state.foods.length}`));
      }

      // Collisions (Snake vs Snake)
      const isGhostActive = state.player.activePowerUps.ghost && state.player.activePowerUps.ghost > Date.now();
      
      if (!isGhostActive) {
        for (const bot of state.bots) {
          for (const segment of bot.segments) {
            const dx = segment.x - playerHead.x;
            const dy = segment.y - playerHead.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const radius = 12 + Math.min(state.player.score / 100, 15);
            if (dist < radius + 10) {
              state.player.isDead = true;
              setGameState('gameover');
              break;
            }
          }
          if (state.player.isDead) break;
        }
      }

      // Sync refs to state for rendering (throttled to ~60fps)
      setPlayer({ ...state.player });
      setBots([...state.bots]);
      setFoods([...state.foods]);

      gameLoopRef.current = requestAnimationFrame(loop);
    };

    gameLoopRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(gameLoopRef.current);
  }, [gameState]);

  useEffect(() => {
    if (player.score > highScore) {
      const newScore = Math.floor(player.score);
      setHighScore(newScore);
      
      // Update Firestore
      if (user) {
        const userDocRef = doc(db, 'users', user.uid);
        updateDoc(userDocRef, {
          highScore: newScore,
          updatedAt: serverTimestamp()
        }).catch(err => console.error('Failed to update score:', err));
      }
    }
  }, [player.score, highScore, user]);

  // Update skin preference in Firestore
  useEffect(() => {
    if (user && gameState === 'start') {
      const userDocRef = doc(db, 'users', user.uid);
      updateDoc(userDocRef, {
        selectedSkinId: selectedSkinId,
        updatedAt: serverTimestamp()
      }).catch(err => console.error('Failed to update skin:', err));
    }
  }, [selectedSkinId, user, gameState]);

  const leaderboard = [
    { name: player.name, score: Math.floor(player.score), isPlayer: true },
    ...bots.map(b => ({ name: b.name, score: Math.floor(b.score), isPlayer: false }))
  ].sort((a, b) => b.score - a.score).slice(0, 10);

  if (loading) {
    return (
      <div className="w-full h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div 
      className="relative w-full h-screen bg-slate-950 overflow-hidden select-none"
      onKeyDown={handleKeyDown}
      onKeyUp={handleKeyUp}
      tabIndex={0}
    >
      {gameState === 'playing' && (
        <>
          <GameCanvas 
            player={player} 
            bots={bots} 
            foods={foods} 
            onMouseMove={handleMouseMove} 
          />

          {/* HUD */}
          <div className="absolute top-6 left-6 flex flex-col gap-2 pointer-events-none">
            <div className="bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl px-6 py-3">
              <div className="text-white/60 text-xs font-bold uppercase tracking-widest mb-1">Score</div>
              <div className="text-3xl font-black text-white font-display">{Math.floor(player.score)}</div>
            </div>
          </div>

          {/* Leaderboard */}
          <div className="absolute top-6 right-6 w-64 bg-black/40 backdrop-blur-md border border-white/10 rounded-2xl p-4 pointer-events-none">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold text-sm uppercase tracking-wider">Leaderboard</span>
            </div>
            <div className="flex flex-col gap-2">
              {leaderboard.map((entry, i) => (
                <div 
                  key={i} 
                  className={`flex justify-between items-center text-xs ${entry.isPlayer ? 'text-blue-400 font-bold' : 'text-white/70'}`}
                >
                  <span className="truncate max-w-[120px]">{i + 1}. {entry.name}</span>
                  <span>{entry.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Controls Hint & Mobile Boost */}
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-6 bg-black/40 backdrop-blur-md border border-white/10 rounded-full px-8 py-3 pointer-events-none sm:pointer-events-auto">
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-6 h-6 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold">M</div>
              <span className="text-white/60 text-xs">Move Mouse</span>
            </div>
            <div className="hidden sm:block w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <div className="px-2 h-6 rounded bg-white/20 flex items-center justify-center text-[10px] font-bold hidden sm:flex">SPACE</div>
              <button 
                onMouseDown={() => setPlayer(prev => ({ ...prev, isBoosting: true }))}
                onMouseUp={() => setPlayer(prev => ({ ...prev, isBoosting: false }))}
                onTouchStart={() => setPlayer(prev => ({ ...prev, isBoosting: true }))}
                onTouchEnd={() => setPlayer(prev => ({ ...prev, isBoosting: false }))}
                className="sm:hidden w-12 h-12 rounded-full bg-blue-500/50 flex items-center justify-center active:scale-90 transition-transform"
              >
                <Zap className="w-6 h-6 text-white fill-current" />
              </button>
              <span className="text-white/60 text-xs">Boost</span>
            </div>
          </div>
        </>
      )}

      <AnimatePresence>
        {gameState === 'start' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xl"
          >
            <div className="w-full max-w-md p-12 text-center">
              {/* Auth Header */}
              <div className="absolute top-8 right-8">
                {user ? (
                  <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-full pl-2 pr-4 py-2">
                    <img src={user.photoURL || ''} alt="" className="w-8 h-8 rounded-full border border-white/20" referrerPolicy="no-referrer" />
                    <span className="text-white text-sm font-bold">{user.displayName}</span>
                    <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-full transition-colors text-white/50 hover:text-white">
                      <LogOut className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <button 
                    onClick={handleLogin}
                    className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full px-6 py-2 text-white text-sm font-bold transition-all"
                  >
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </button>
                )}
              </div>

              <motion.div
                initial={{ y: -20 }}
                animate={{ y: 0 }}
                className="mb-12"
              >
                <h1 className="text-7xl font-black text-white font-display tracking-tighter mb-2">
                  snake<span className="text-blue-500">-sn</span>
                </h1>
                <p className="text-white/40 font-medium">Developed by د. احمد دحداح</p>
              </motion.div>

              <div className="space-y-6">
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/30" />
                  <input 
                    type="text" 
                    placeholder="Enter your name..."
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-4 text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                  />
                </div>

                {/* Skin Selection */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4">
                  <div className="text-white/40 text-xs font-bold uppercase tracking-widest mb-3 text-left">Select Skin</div>
                  <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
                    {SKINS.map(skin => (
                      <button
                        key={skin.id}
                        onClick={() => setSelectedSkinId(skin.id)}
                        className={`flex-shrink-0 w-12 h-12 rounded-full border-2 transition-all ${selectedSkinId === skin.id ? 'border-white scale-110 shadow-lg shadow-white/20' : 'border-transparent opacity-50 hover:opacity-100'}`}
                        style={{ 
                          background: skin.pattern === 'striped' 
                            ? `linear-gradient(45deg, ${skin.colors[0]} 50%, ${skin.colors[1]} 50%)` 
                            : skin.colors[0],
                          boxShadow: skin.pattern === 'glow' ? `0 0 10px ${skin.colors[0]}` : 'none'
                        }}
                        title={skin.name}
                      />
                    ))}
                  </div>
                </div>

                <button 
                  onClick={initGame}
                  className="group relative w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-5 rounded-2xl transition-all shadow-lg shadow-blue-900/20 flex items-center justify-center gap-3 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                  <Play className="w-6 h-6 fill-current" />
                  <span className="text-xl">Play Now</span>
                </button>

                {highScore > 0 && (
                  <div className="text-white/40 text-sm font-medium">
                    Best Score: <span className="text-white">{highScore}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {gameState === 'gameover' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-red-950/90 backdrop-blur-xl"
          >
            <div className="w-full max-w-md p-12 text-center">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="mb-8 flex justify-center"
              >
                <div className="w-24 h-24 rounded-full bg-red-500/20 flex items-center justify-center border-4 border-red-500/50">
                  <Skull className="w-12 h-12 text-red-500" />
                </div>
              </motion.div>

              <h2 className="text-5xl font-black text-white font-display mb-2">Game Over</h2>
              <p className="text-red-200/60 font-medium mb-12">You crashed into another snake!</p>

              <div className="bg-white/5 rounded-3xl p-8 mb-12 border border-white/10">
                <div className="grid grid-cols-2 gap-8">
                  <div>
                    <div className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Final Score</div>
                    <div className="text-4xl font-black text-white font-display">{Math.floor(player.score)}</div>
                  </div>
                  <div>
                    <div className="text-white/40 text-xs font-bold uppercase tracking-widest mb-1">Best Score</div>
                    <div className="text-4xl font-black text-white font-display">{highScore}</div>
                  </div>
                </div>
              </div>

              <button 
                onClick={initGame}
                className="w-full bg-white text-slate-950 font-bold py-5 rounded-2xl hover:bg-white/90 transition-all flex items-center justify-center gap-3"
              >
                <Play className="w-6 h-6 fill-current" />
                <span className="text-xl">Try Again</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
