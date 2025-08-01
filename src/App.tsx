import React, { useState, useEffect, useCallback } from 'react';
import { Play, Pause, RotateCcw, Trophy } from 'lucide-react';
import StickFigure from './components/StickFigure';

interface Player {
  x: number;
  y: number;
}

interface Obstacle {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  type?: 'pit' | 'ground_box' | 'air_box' | 'normal';
  lane?: number; // For top screen obstacles
}

const GAME_WIDTH = 800;
const GAME_HEIGHT = 300;
const PLAYER_SIZE = 30;
const OBSTACLE_WIDTH = 20;
const OBSTACLE_HEIGHT = 60;
const GROUND_HEIGHT = 50;
const MIN_OBSTACLE_DISTANCE = 150; // 障碍物之间的最小距离
const LANES = 5; // 五条车道
const ROAD_WIDTH = GAME_WIDTH * 0.6; // 道路占屏幕60%宽度
const ROAD_OFFSET = (GAME_WIDTH - ROAD_WIDTH) / 2; // 道路居中偏移
const LANE_WIDTH = ROAD_WIDTH / LANES;
const TOP_PLAYER_Y = GAME_HEIGHT - 40; // 固定在屏幕底部附近

function App() {
  // Game state
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'paused' | 'gameOver'>('idle');
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('dualRunnerHighScore');
    return saved ? parseInt(saved, 10) : 0;
  });

  // Players state
  const [bottomPlayer, setBottomPlayer] = useState<Player>({ x: 100, y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE / 2 });
  const [topPlayer, setTopPlayer] = useState<Player>({ x: ROAD_OFFSET + LANE_WIDTH * 2 + LANE_WIDTH / 2, y: TOP_PLAYER_Y }); // 开始在中间车道
  const [topPlayerLane, setTopPlayerLane] = useState(2); // 当前车道 (0-4)

  // Obstacles state
  const [bottomObstacles, setBottomObstacles] = useState<Obstacle[]>([]);
  const [topObstacles, setTopObstacles] = useState<Obstacle[]>([]);

  // Game speed
  const [gameSpeed, setGameSpeed] = useState(2);

  // 障碍物生成间隔控制
  const [lastTopObstacleTime, setLastTopObstacleTime] = useState(0);
  const [lastBottomObstacleX, setLastBottomObstacleX] = useState(GAME_WIDTH);

  // Keys pressed
  const [keysPressed, setKeysPressed] = useState<Set<string>>(new Set());

  // Player states
  const [bottomPlayerState, setBottomPlayerState] = useState<'running' | 'jumping' | 'sliding'>('running');
  const [jumpVelocity, setJumpVelocity] = useState(0);

  // Handle keyboard input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeysPressed(prev => new Set(prev).add(e.key));
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      setKeysPressed(prev => {
        const newSet = new Set(prev);
        newSet.delete(e.key);
        return newSet;
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update player positions based on input
  useEffect(() => {
    if (gameState !== 'playing') return;

    const updatePlayers = () => {
      // Bottom player (jump/slide mechanics)
      setBottomPlayer(prev => {
        const groundY = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE / 2;
        let newY = prev.y;
        
        // Handle jumping
        if ((keysPressed.has('ArrowUp') || keysPressed.has('w') || keysPressed.has('W')) && 
            bottomPlayerState === 'running' && prev.y >= groundY - 5) {
          setBottomPlayerState('jumping');
          setJumpVelocity(-18); // 增加跳跃力度确保能跳过木箱
        }
        
        // Handle sliding
        if ((keysPressed.has('ArrowDown') || keysPressed.has('s') || keysPressed.has('S')) && 
            bottomPlayerState === 'running') {
          setBottomPlayerState('sliding');
          setTimeout(() => setBottomPlayerState('running'), 500);
        }
        
        return { ...prev, y: newY };
      });

      // Top player lane-based movement (discrete steps)
      if (keysPressed.has('ArrowLeft') || keysPressed.has('a') || keysPressed.has('A')) {
        setTopPlayerLane(prev => {
          const newLane = Math.max(0, prev - 1);
          setTopPlayer(p => ({ ...p, x: ROAD_OFFSET + newLane * LANE_WIDTH + LANE_WIDTH / 2 }));
          return newLane;
        });
        // Remove the key to prevent continuous movement
        setKeysPressed(prev => {
          const newSet = new Set(prev);
          newSet.delete('ArrowLeft');
          newSet.delete('a');
          newSet.delete('A');
          return newSet;
        });
      }
      if (keysPressed.has('ArrowRight') || keysPressed.has('d') || keysPressed.has('D')) {
        setTopPlayerLane(prev => {
          const newLane = Math.min(LANES - 1, prev + 1);
          setTopPlayer(p => ({ ...p, x: ROAD_OFFSET + newLane * LANE_WIDTH + LANE_WIDTH / 2 }));
          return newLane;
        });
        // Remove the key to prevent continuous movement
        setKeysPressed(prev => {
          const newSet = new Set(prev);
          newSet.delete('ArrowRight');
          newSet.delete('d');
          newSet.delete('D');
          return newSet;
        });
      }
    };

    const interval = setInterval(updatePlayers, 16);
    return () => clearInterval(interval);
  }, [keysPressed, gameState, bottomPlayerState]);

  // Handle jumping physics
  useEffect(() => {
    if (gameState !== 'playing' || bottomPlayerState !== 'jumping') return;

    const jumpPhysics = setInterval(() => {
      setBottomPlayer(prev => {
        const groundY = GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE / 2;
        let newY = prev.y + jumpVelocity;
        
        if (newY >= groundY) {
          newY = groundY;
          setBottomPlayerState('running');
          setJumpVelocity(0);
        } else {
          setJumpVelocity(prev => prev + 0.7); // gravity
        }
        
        return { ...prev, y: newY };
      });
    }, 16);

    return () => clearInterval(jumpPhysics);
  }, [gameState, bottomPlayerState, jumpVelocity]);

  // Generate obstacles
  const generateObstacle = useCallback((isTop: boolean): Obstacle => {
    const id = Math.random();
    if (isTop) {
      // 上屏障碍物：五车道随机生成，但不会全部堵死
      const availableLanes = Array.from({ length: LANES }, (_, i) => i);
      const numObstacles = Math.floor(Math.random() * (LANES - 1)) + 1; // 1到4个障碍物
      const obstacleLanes = availableLanes.sort(() => 0.5 - Math.random()).slice(0, numObstacles);
      
      // 返回第一个障碍物，其他的会在同一时间生成
      const lane = obstacleLanes[0];
      return {
        id,
        x: ROAD_OFFSET + lane * LANE_WIDTH + LANE_WIDTH * 0.1,
        y: -30,
        width: LANE_WIDTH * 0.8,
        height: 30,
        type: 'normal',
        lane: lane,
      };
    } else {
      // Bottom screen obstacles: pits, ground boxes, and air boxes
      const rand = Math.random();
      let obstacleType: 'pit' | 'ground_box' | 'air_box';
      if (rand < 0.33) {
        obstacleType = 'pit';
      } else if (rand < 0.66) {
        obstacleType = 'ground_box';
      } else {
        obstacleType = 'air_box';
      }
      
      if (obstacleType === 'pit') {
        // 地坑 - 白色倒三角
        return {
          id,
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - 5,
          width: 50,
          height: 30,
          type: 'pit',
        };
      } else if (obstacleType === 'ground_box') {
        // 地面箱子 - 需要跳跃
        return {
          id,
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - 40,
          width: 35,
          height: 40,
          type: 'ground_box',
        };
      } else {
        // 空中箱子 - 需要滑铲
        return {
          id,
          x: GAME_WIDTH,
          y: GAME_HEIGHT - GROUND_HEIGHT - 80,
          width: 35,
          height: 35,
          type: 'air_box',
        };
      }
    }
  }, []);

  // Game loop
  useEffect(() => {
    if (gameState !== 'playing') return;

    const gameLoop = setInterval(() => {
      // Move obstacles
      setBottomObstacles(prev => 
        prev
          .map(obs => ({ ...obs, x: obs.x - gameSpeed }))
          .filter(obs => obs.x > -obs.width)
      );

      // 上屏障碍物向下移动（模拟向上跑）
      setTopObstacles(prev => 
        prev
          .map(obs => ({ ...obs, y: obs.y + gameSpeed * 2 }))
          .filter(obs => obs.y < GAME_HEIGHT + obs.height)
      );

      // Generate new obstacles
      // 下屏障碍物生成 - 确保间距
      if (Math.random() < 0.015) {
        setLastBottomObstacleX(prev => {
          if (GAME_WIDTH - prev > MIN_OBSTACLE_DISTANCE) {
            setBottomObstacles(obstacles => [...obstacles, generateObstacle(false)]);
            return GAME_WIDTH;
          }
          return prev;
        });
      }
      
      // 更新最后一个障碍物的位置
      setLastBottomObstacleX(prev => {
        const lastObstacle = bottomObstacles[bottomObstacles.length - 1];
        return lastObstacle ? lastObstacle.x : prev - gameSpeed;
      });
      
      // 上屏障碍物生成 - 增加间隔控制
      const currentTime = Date.now();
      if (Math.random() < 0.015 && currentTime - lastTopObstacleTime > 2000) { // 至少2秒间隔
        // 生成一组障碍物（随机1-4个车道有障碍）
        const availableLanes = Array.from({ length: LANES }, (_, i) => i);
        const numObstacles = Math.floor(Math.random() * (LANES - 1)) + 1;
        const obstacleLanes = availableLanes.sort(() => 0.5 - Math.random()).slice(0, numObstacles);
        
        const newObstacles = obstacleLanes.map(lane => ({
          id: Math.random(),
          x: ROAD_OFFSET + lane * LANE_WIDTH + LANE_WIDTH * 0.1,
          y: -30,
          width: LANE_WIDTH * 0.8,
          height: 30,
          type: 'normal' as const,
          lane: lane,
        }));
        
        setTopObstacles(prev => [...prev, ...newObstacles]);
        setLastTopObstacleTime(currentTime);
      }

      // Update score
      setScore(prev => prev + 1);

      // Increase game speed gradually
      setGameSpeed(prev => Math.min(prev + 0.001, 5));
    }, 16);

    return () => clearInterval(gameLoop);
  }, [gameState, gameSpeed, generateObstacle, lastTopObstacleTime]);

  // Collision detection
  useEffect(() => {
    if (gameState !== 'playing') return;

    const checkCollision = (player: Player, obstacles: Obstacle[], isBottom: boolean = false): boolean => {
      return obstacles.some(obs => {
        let playerLeft = player.x - PLAYER_SIZE / 2;
        let playerRight = player.x + PLAYER_SIZE / 2;
        let playerTop = player.y - PLAYER_SIZE / 2;
        let playerBottom = player.y + PLAYER_SIZE / 2;
        
        // Adjust hitbox for sliding
        if (isBottom && bottomPlayerState === 'sliding') {
          playerTop = player.y;
          playerBottom = player.y + PLAYER_SIZE / 4;
        }

        const obsLeft = obs.x;
        const obsRight = obs.x + obs.width;
        const obsTop = obs.y;
        const obsBottom = obs.y + obs.height;

        return (
          playerRight > obsLeft &&
          playerLeft < obsRight &&
          playerBottom > obsTop &&
          playerTop < obsBottom
        );
      });
    };

    if (checkCollision(bottomPlayer, bottomObstacles, true) || checkCollision(topPlayer, topObstacles)) {
      setGameState('gameOver');
      if (score > highScore) {
        setHighScore(score);
        localStorage.setItem('dualRunnerHighScore', score.toString());
      }
    }
  }, [bottomPlayer, topPlayer, bottomObstacles, topObstacles, gameState, score, highScore, bottomPlayerState]);

  const startGame = () => {
    setGameState('playing');
    setScore(0);
    setGameSpeed(2);
    setBottomPlayer({ x: 100, y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE / 2 });
    setTopPlayer({ x: ROAD_OFFSET + LANE_WIDTH * 2 + LANE_WIDTH / 2, y: TOP_PLAYER_Y });
    setTopPlayerLane(2);
    setBottomObstacles([]);
    setTopObstacles([]);
    setBottomPlayerState('running');
    setJumpVelocity(0);
    setLastTopObstacleTime(0);
  };

  const pauseGame = () => {
    setGameState(gameState === 'paused' ? 'playing' : 'paused');
  };

  const resetGame = () => {
    setGameState('idle');
    setScore(0);
    setGameSpeed(2);
    setBottomPlayer({ x: 100, y: GAME_HEIGHT - GROUND_HEIGHT - PLAYER_SIZE / 2 });
    setTopPlayer({ x: ROAD_OFFSET + LANE_WIDTH * 2 + LANE_WIDTH / 2, y: TOP_PLAYER_Y });
    setTopPlayerLane(2);
    setBottomObstacles([]);
    setTopObstacles([]);
    setBottomPlayerState('running');
    setJumpVelocity(0);
    setLastTopObstacleTime(0);
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="bg-gray-100 rounded-2xl p-8 shadow-2xl border border-gray-300">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-bold text-black mb-2 flex items-center justify-center gap-3">
            <Trophy className="text-yellow-600" />
            双屏跑酷挑战
          </h1>
          <p className="text-gray-600">上屏左右避障，下屏上下避障</p>
        </div>

        {/* Score Display */}
        <div className="flex justify-between items-center mb-6 text-black">
          <div className="bg-gray-200 rounded-lg px-4 py-2 border border-gray-300">
            <div className="text-sm text-gray-600">当前得分</div>
            <div className="text-2xl font-bold">{score}</div>
          </div>
          <div className="bg-gray-200 rounded-lg px-4 py-2 border border-gray-300">
            <div className="text-sm text-gray-600">最高分</div>
            <div className="text-2xl font-bold text-yellow-600">{highScore}</div>
          </div>
        </div>

        {/* Game Area */}
        <div className="relative bg-white rounded-lg overflow-hidden shadow-2xl border-2 border-black">
          {/* Top Screen */}
          <div 
            className="relative bg-white border-b-2 border-black"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          >
            {/* 道路两旁的装饰 */}
            <svg className="absolute inset-0 w-full h-full">
              {/* 左侧草地和装饰 */}
              <rect x="0" y="0" width={ROAD_OFFSET} height={GAME_HEIGHT} fill="#90EE90" />
              {/* 右侧草地和装饰 */}
              <rect x={ROAD_OFFSET + ROAD_WIDTH} y="0" width={ROAD_OFFSET} height={GAME_HEIGHT} fill="#90EE90" />
              
              {/* 左侧树木装饰 */}
              {Array.from({ length: 8 }, (_, i) => (
                <g key={`left-tree-${i}`}>
                  <rect 
                    x={20 + (i % 3) * 15} 
                    y={i * 40} 
                    width="4" 
                    height="15" 
                    fill="#8B4513" 
                  />
                  <circle 
                    cx={22 + (i % 3) * 15} 
                    cy={i * 40} 
                    r="8" 
                    fill="#228B22" 
                  />
                </g>
              ))}
              
              {/* 右侧花草装饰 */}
              {Array.from({ length: 10 }, (_, i) => (
                <g key={`right-flower-${i}`}>
                  <circle 
                    cx={ROAD_OFFSET + ROAD_WIDTH + 30 + (i % 4) * 12} 
                    cy={i * 30 + 10} 
                    r="3" 
                    fill={i % 2 === 0 ? "#FF69B4" : "#FFD700"} 
                  />
                  <line 
                    x1={ROAD_OFFSET + ROAD_WIDTH + 30 + (i % 4) * 12} 
                    y1={i * 30 + 13} 
                    x2={ROAD_OFFSET + ROAD_WIDTH + 30 + (i % 4) * 12} 
                    y2={i * 30 + 20} 
                    stroke="#228B22" 
                    strokeWidth="2" 
                  />
                </g>
              ))}
              
              {/* 道路边界 */}
              <line x1={ROAD_OFFSET} y1="0" x2={ROAD_OFFSET} y2={GAME_HEIGHT} stroke="#333" strokeWidth="3" />
              <line x1={ROAD_OFFSET + ROAD_WIDTH} y1="0" x2={ROAD_OFFSET + ROAD_WIDTH} y2={GAME_HEIGHT} stroke="#333" strokeWidth="3" />
              
              {/* 车道分隔线 */}
              {Array.from({ length: LANES + 1 }, (_, i) => (
                <line
                  key={i}
                  x1={ROAD_OFFSET + i * LANE_WIDTH}
                  y1="0"
                  x2={ROAD_OFFSET + i * LANE_WIDTH}
                  y2={GAME_HEIGHT}
                  stroke="#ccc"
                  strokeWidth="2"
                />
              ))}
              
              {/* 道路中心虚线 */}
              {Array.from({ length: LANES - 1 }, (_, i) => (
                <g key={`dashed-${i}`}>
                  {Array.from({ length: 10 }, (_, j) => (
                    <line
                      key={j}
                      x1={ROAD_OFFSET + (i + 1) * LANE_WIDTH}
                      y1={j * (GAME_HEIGHT / 5)}
                      x2={ROAD_OFFSET + (i + 1) * LANE_WIDTH}
                      y2={j * (GAME_HEIGHT / 5) + 20}
                      stroke="#999"
                      strokeWidth="2"
                      strokeDasharray="5,5"
                    />
                  ))}
                </g>
              ))}
            </svg>
            
            {/* Top Player - Stick Figure */}
            <svg className="absolute inset-0 w-full h-full">
              <StickFigure 
                x={topPlayer.x} 
                y={topPlayer.y} 
                size={PLAYER_SIZE} 
                isRunning={gameState === 'playing'}
                direction="right"
              />
            </svg>

            {/* Top Obstacles */}
            {topObstacles.map(obs => (
              <div
                key={obs.id}
                className="absolute bg-black border-2 border-gray-800"
                style={{
                  left: obs.x,
                  top: obs.y,
                  width: obs.width,
                  height: obs.height,
                }}
              />
            ))}

            <div className="absolute top-2 left-2 text-black text-sm font-semibold bg-gray-200 px-2 py-1 rounded border">
              上屏: ← → 键切换车道 (当前车道: {topPlayerLane + 1})
            </div>
          </div>

          {/* Divider */}
          <div className="h-1 bg-black"></div>

          {/* Bottom Screen */}
          <div 
            className="relative bg-white"
            style={{ width: GAME_WIDTH, height: GAME_HEIGHT }}
          >
            {/* Ground */}
            <div 
              className="absolute left-0 right-0 bg-green-200 border-t-2 border-green-600"
              style={{ 
                bottom: 0, 
                height: GROUND_HEIGHT 
              }}
            >
              {/* Grass texture */}
              <div className="absolute top-0 left-0 right-0 h-2 bg-green-400"></div>
            </div>
            
            {/* Bottom Player - Stick Figure */}
            <svg className="absolute inset-0 w-full h-full">
              <StickFigure 
                x={bottomPlayer.x} 
                y={bottomPlayerState === 'sliding' ? bottomPlayer.y + PLAYER_SIZE / 4 : bottomPlayer.y} 
                size={PLAYER_SIZE} 
                isRunning={gameState === 'playing'}
                direction="right"
              />
            </svg>

            {/* Bottom Obstacles */}
            {bottomObstacles.map(obs => (
              obs.type === 'pit' ? (
                // 地坑 - 白色倒三角
                <div
                  key={obs.id}
                  className="absolute flex items-end justify-center"
                  style={{
                    left: obs.x,
                    top: obs.y,
                    width: obs.width,
                    height: obs.height,
                  }}
                >
                  <svg width={obs.width} height={obs.height} className="absolute bottom-0">
                    <polygon 
                      points={`${obs.width/2},5 5,${obs.height} ${obs.width-5},${obs.height}`}
                      fill="white" 
                      stroke="black" 
                      strokeWidth="2"
                    />
                  </svg>
                </div>
              ) : obs.type === 'ground_box' ? (
                // 地面箱子 - 需要跳跃
                <div
                  key={obs.id}
                  className="absolute bg-amber-600 border-2 border-amber-800"
                  style={{
                    left: obs.x,
                    top: obs.y,
                    width: obs.width,
                    height: obs.height,
                  }}
                >
                  {/* Wood texture lines */}
                  <div className="absolute inset-1 border border-amber-700 opacity-50"></div>
                  <div className="absolute top-2 left-1 right-1 h-0.5 bg-amber-700 opacity-50"></div>
                  <div className="absolute bottom-2 left-1 right-1 h-0.5 bg-amber-700 opacity-50"></div>
                </div>
              ) : (
                // 空中箱子 - 需要滑铲
                <div
                  key={obs.id}
                  className="absolute bg-gray-600 border-2 border-gray-800"
                  style={{
                    left: obs.x,
                    top: obs.y,
                    width: obs.width,
                    height: obs.height,
                  }}
                >
                  {/* 金属箱子纹理 */}
                  <div className="absolute inset-1 border border-gray-700 opacity-50"></div>
                  <div className="absolute top-1 left-1 right-1 h-0.5 bg-gray-400 opacity-50"></div>
                  <div className="absolute bottom-1 left-1 right-1 h-0.5 bg-gray-800 opacity-50"></div>
                  <div className="absolute top-1 bottom-1 left-1 w-0.5 bg-gray-400 opacity-50"></div>
                  <div className="absolute top-1 bottom-1 right-1 w-0.5 bg-gray-800 opacity-50"></div>
                </div>
              )
            ))}

            <div className="absolute bottom-2 left-2 text-black text-sm font-semibold bg-gray-200 px-2 py-1 rounded border">
              下屏: ↑ 跳跃 ↓ 下滑
            </div>
          </div>

          {/* Game Over Overlay */}
          {gameState === 'gameOver' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 text-center text-black border-2 border-gray-300 shadow-2xl">
                <h2 className="text-3xl font-bold mb-4">游戏结束!</h2>
                <p className="text-xl mb-2">最终得分: {score}</p>
                {score === highScore && (
                  <p className="text-yellow-600 font-semibold mb-4">🎉 新纪录!</p>
                )}
                <button
                  onClick={startGame}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg border-2 border-blue-700"
                >
                  重新开始
                </button>
              </div>
            </div>
          )}

          {/* Pause Overlay */}
          {gameState === 'paused' && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 text-center text-black border-2 border-gray-300 shadow-2xl">
                <h2 className="text-2xl font-bold mb-4">游戏暂停</h2>
                <button
                  onClick={pauseGame}
                  className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-lg font-semibold transition-all duration-200 shadow-lg border-2 border-green-700"
                >
                  继续游戏
                </button>
              </div>
            </div>
          )}

          {/* Start Screen */}
          {gameState === 'idle' && (
            <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
              <div className="bg-white rounded-2xl p-8 text-center text-black border-2 border-gray-300 shadow-2xl">
                <h2 className="text-3xl font-bold mb-4">准备开始!</h2>
                <p className="mb-6 text-gray-600">
                  上屏使用左右键避开障碍物
                  <br />
                  下屏按↑跳过坑洞，按↓滑过木箱
                  <br />
                  坚持得越久分数越高！
                </p>
                <button
                  onClick={startGame}
                  className="bg-green-500 hover:bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg transition-all duration-200 shadow-lg border-2 border-green-700 flex items-center gap-2 mx-auto"
                >
                  <Play size={20} />
                  开始游戏
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Control Buttons */}
        <div className="flex justify-center gap-4 mt-6">
          {gameState === 'playing' && (
            <button
              onClick={pauseGame}
              className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg border-2 border-yellow-700 flex items-center gap-2"
            >
              <Pause size={16} />
              暂停
            </button>
          )}
          
          {(gameState === 'playing' || gameState === 'paused') && (
            <button
              onClick={resetGame}
              className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold transition-all duration-200 shadow-lg border-2 border-red-700 flex items-center gap-2"
            >
              <RotateCcw size={16} />
              重置
            </button>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 text-center text-gray-600 text-sm">
          <p>键盘控制: WASD 或 方向键 | 下屏: ↑跳跃避开坑洞, ↓下滑避开木箱</p>
        </div>
      </div>
    </div>
  );
}

export default App;