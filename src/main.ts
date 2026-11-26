import { Game } from './core/game.js';

async function main(): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  document.getElementById('app')!.appendChild(canvas);
  
  const game = new Game(canvas);
  
  try {
    await game.init();
  } catch (error) {
    console.error('Failed to initialize game:', error);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <div class="loading-title">ERROR</div>
        <div class="loading-text">Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}</div>
      `;
    }
  }
  
  // Expose for debugging
  (window as any).game = game;
}

main();