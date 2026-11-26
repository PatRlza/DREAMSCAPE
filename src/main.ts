import { Game } from './core/game.js';

async function main(): Promise<void> {
  const canvas = document.createElement('canvas');
  canvas.id = 'game-canvas';
  canvas.style.cssText = 'position: fixed; inset: 0; z-index: 0;';
  document.getElementById('app')!.appendChild(canvas);
  
  const game = new Game(canvas);
  
  // Safety timeout - force hide loading after 10 seconds
  const safetyTimeout = setTimeout(() => {
    const loading = document.getElementById('loading');
    if (loading && !loading.classList.contains('hidden')) {
      console.warn('Safety timeout: forcing loading screen removal');
      loading.classList.add('hidden');
      setTimeout(() => loading.remove(), 500);
    }
  }, 10000);
  
  try {
    await game.init();
    clearTimeout(safetyTimeout);
  } catch (error) {
    clearTimeout(safetyTimeout);
    console.error('Failed to initialize game:', error);
    const loading = document.getElementById('loading');
    if (loading) {
      loading.innerHTML = `
        <div class="loading-title">ERROR</div>
        <div class="loading-text">Failed to initialize: ${error instanceof Error ? error.message : 'Unknown error'}</div>
        <button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:#8ba4b8;border:none;color:#1a1d24;cursor:pointer;">Reload</button>
      `;
    }
  }
  
  // Expose for debugging
  (window as any).game = game;
}

main();