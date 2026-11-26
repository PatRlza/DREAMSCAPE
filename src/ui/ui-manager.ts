import * as THREE from 'three';
import { gsap } from 'gsap';
import { EventEmitter } from '../utils/event-emitter.js';
import type { SettingsData, GameMode, RenderMode, QualityPreset, JournalEntry, InteractionPrompt } from '../utils/types.js';
import { Game } from '../core/game.js';
import { GAME_CONFIG } from '../core/constants.js';

interface UIState {
  mainMenuVisible: boolean;
  pauseMenuVisible: boolean;
  journalVisible: boolean;
  settingsVisible: boolean;
  currentPrompt: InteractionPrompt | null;
  currentHint: { content: string; tier: number } | null;
  transitionOverlay: boolean;
  transitionText: string;
}

export class UIManager extends EventEmitter {
  private game: Game;
  private container: HTMLElement;
  private state: UIState = {
    mainMenuVisible: true,
    pauseMenuVisible: false,
    journalVisible: false,
    settingsVisible: false,
    currentPrompt: null,
    currentHint: null,
    transitionOverlay: false,
    transitionText: ''
  };
  
  private elements: Record<string, any> = {};
  private reducedMotion = false;
  private highContrast = false;
  private language: 'en' | 'ru' = 'en';
  
  private texts = {
    en: {
      title: 'DREAMSCAPE',
      continue: 'Continue',
      newJourney: 'New Journey',
      infiniteDream: 'Infinite Dream',
      settings: 'Settings',
      about: 'About',
      resume: 'Resume',
      restart: 'Restart',
      quit: 'Quit',
      renderMode: 'Render Mode',
      quality: 'Quality',
      musicVolume: 'Music Volume',
      ambientVolume: 'Ambient Volume',
      sfxVolume: 'SFX Volume',
      masterVolume: 'Master Volume',
      mouseSensitivity: 'Mouse Sensitivity',
      touchSensitivity: 'Touch Sensitivity',
      invertY: 'Invert Y Axis',
      reducedMotion: 'Reduced Motion',
      highContrast: 'High Contrast',
      language: 'Language',
      journal: 'Journal',
      symbols: 'Symbols',
      phrases: 'Phrases',
      patterns: 'Patterns',
      hints: 'Hints',
      observations: 'Observations',
      empty: 'No entries yet',
      controls: 'Controls',
      move: 'Move',
      look: 'Look',
      interact: 'Interact',
      journalKey: 'Journal',
      renderModeKey: 'Render Mode',
      menu: 'Menu'
    },
    ru: {
      title: 'DREAMSCAPE',
      continue: 'Продолжить',
      newJourney: 'Новое путешествие',
      infiniteDream: 'Бесконечный сон',
      settings: 'Настройки',
      about: 'Об игре',
      resume: 'Продолжить',
      restart: 'Начать заново',
      quit: 'Выйти',
      renderMode: 'Режим графики',
      quality: 'Качество',
      musicVolume: 'Громкость музыки',
      ambientVolume: 'Громкость окружения',
      sfxVolume: 'Громкость эффектов',
      masterVolume: 'Общая громкость',
      mouseSensitivity: 'Чувствительность мыши',
      touchSensitivity: 'Чувствительность тача',
      invertY: 'Инвертировать ось Y',
      reducedMotion: 'Уменьшенная анимация',
      highContrast: 'Высокий контраст',
      language: 'Язык',
      journal: 'Журнал',
      symbols: 'Символы',
      phrases: 'Фразы',
      patterns: 'Закономерности',
      hints: 'Подсказки',
      observations: 'Наблюдения',
      empty: 'Записей пока нет',
      controls: 'Управление',
      move: 'Движение',
      look: 'Взгляд',
      interact: 'Взаимодействие',
      journalKey: 'Журнал',
      renderModeKey: 'Режим графики',
      menu: 'Меню'
    }
  };
  
  constructor(game: Game) {
    super();
    this.game = game;
    this.container = document.getElementById('app')!;
    this.createUI();
    this.bindEvents();
  }
  
  private createUI(): void {
    // Main UI container
    const uiRoot = document.createElement('div');
    uiRoot.id = 'ui-root';
    uiRoot.style.cssText = `
      position: fixed; inset: 0; z-index: 100;
      font-family: system-ui, -apple-system, sans-serif;
      color: #d8dce3;
    `;
    this.container.appendChild(uiRoot);
    this.elements.root = uiRoot;
    
    this.createMainMenu(uiRoot);
    this.createPauseMenu(uiRoot);
    this.createHUD(uiRoot);
    this.createJournal(uiRoot);
    this.createSettings(uiRoot);
    this.createTransitionOverlay(uiRoot);
  }
  
  private createMainMenu(parent: HTMLElement): void {
    const menu = document.createElement('div');
    menu.id = 'main-menu';
    menu.style.cssText = `
      position: absolute; inset: 0; display: flex; flex-direction: column;
      align-items: center; justify-content: center; gap: 2rem;
      background: rgba(26, 29, 36, 0.95); backdrop-filter: blur(10px);
      pointer-events: auto; transition: opacity 0.5s, visibility 0.5s;
    `;
    
    const title = document.createElement('h1');
    title.textContent = this.t('title');
    title.style.cssText = `
      font-size: clamp(3rem, 10vw, 6rem); font-weight: 100; letter-spacing: 0.4em;
      text-transform: uppercase; color: #8ba4b8; margin: 0;
    `;
    
    const buttons = document.createElement('div');
    buttons.style.cssText = `display: flex; flex-direction: column; gap: 1rem; min-width: 280px;`;
    
    const btnStyle = `
      padding: 1rem 2rem; font-size: 1.1rem; letter-spacing: 0.1em;
      background: transparent; border: 1px solid #8ba4b8; color: #d8dce3;
      cursor: pointer; transition: all 0.3s; text-transform: uppercase;
    `;
    
    const hoverStyle = `background: #8ba4b8; color: #1a1d24;`;
    
    const createBtn = (text: string, id: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.textContent = text;
      btn.style.cssText = btnStyle;
      btn.addEventListener('mouseenter', () => btn.style.cssText = btnStyle + hoverStyle);
      btn.addEventListener('mouseleave', () => btn.style.cssText = btnStyle);
      btn.addEventListener('click', onClick);
      return btn;
    };
    
    buttons.appendChild(createBtn(this.t('continue'), 'btn-continue', () => this.emit('continueGame')));
    buttons.appendChild(createBtn(this.t('newJourney'), 'btn-new-journey', () => this.emit('newGame', 'journey')));
    buttons.appendChild(createBtn(this.t('infiniteDream'), 'btn-infinite', () => this.emit('newGame', 'infinite')));
    buttons.appendChild(createBtn(this.t('settings'), 'btn-settings', () => this.showSettings(true)));
    buttons.appendChild(createBtn(this.t('about'), 'btn-about', () => this.showAbout()));
    
    menu.appendChild(title);
    menu.appendChild(buttons);
    
    this.elements.mainMenu = menu;
    parent.appendChild(menu);
  }
  
  private createPauseMenu(parent: HTMLElement): void {
    const menu = document.createElement('div');
    menu.id = 'pause-menu';
    menu.style.cssText = `
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 1.5rem;
      background: rgba(26, 29, 36, 0.95); backdrop-filter: blur(10px);
      pointer-events: auto; z-index: 200;
    `;
    
    const title = document.createElement('h2');
    title.textContent = this.t('title');
    title.style.cssText = `
      font-size: clamp(2rem, 6vw, 4rem); font-weight: 200; letter-spacing: 0.2em;
      text-transform: uppercase; color: #8ba4b8; margin: 0;
    `;
    
    const buttons = document.createElement('div');
    buttons.style.cssText = `display: flex; flex-direction: column; gap: 1rem; min-width: 280px;`;
    
    const btnStyle = `
      padding: 1rem 2rem; font-size: 1.1rem; letter-spacing: 0.1em;
      background: transparent; border: 1px solid #8ba4b8; color: #d8dce3;
      cursor: pointer; transition: all 0.3s; text-transform: uppercase;
    `;
    
    const createBtn = (text: string, id: string, onClick: () => void) => {
      const btn = document.createElement('button');
      btn.id = id;
      btn.textContent = text;
      btn.style.cssText = btnStyle;
      btn.addEventListener('mouseenter', () => btn.style.cssText = btnStyle + `background: #8ba4b8; color: #1a1d24;`);
      btn.addEventListener('mouseleave', () => btn.style.cssText = btnStyle);
      btn.addEventListener('click', onClick);
      return btn;
    };
    
    buttons.appendChild(createBtn(this.t('resume'), 'btn-resume', () => this.hidePauseMenu()));
    buttons.appendChild(createBtn(this.t('settings'), 'btn-pause-settings', () => { this.hidePauseMenu(); this.showSettings(true); }));
    buttons.appendChild(createBtn(this.t('restart'), 'btn-restart', () => { this.hidePauseMenu(); this.emit('newGame', this.game.getMode()); }));
    buttons.appendChild(createBtn(this.t('quit'), 'btn-quit', () => this.emit('quit')));
    
    menu.appendChild(title);
    menu.appendChild(buttons);
    
    this.elements.pauseMenu = menu;
    parent.appendChild(menu);
  }
  
  private createHUD(parent: HTMLElement): void {
    const hud = document.createElement('div');
    hud.id = 'hud';
    hud.style.cssText = `
      position: absolute; inset: 0; pointer-events: none; z-index: 50;
      display: flex; flex-direction: column;
    `;
    
    // Top bar - render mode, journal, settings
    const topBar = document.createElement('div');
    topBar.style.cssText = `
      display: flex; justify-content: space-between; padding: 1rem;
      pointer-events: auto;
    `;
    
    // Left: render mode indicator
    const renderModeBtn = document.createElement('button');
    renderModeBtn.id = 'hud-render-mode';
    renderModeBtn.textContent = '◈ Dream';
    renderModeBtn.style.cssText = `
      padding: 0.5rem 1rem; background: rgba(26,29,36,0.8); border: 1px solid #8ba4b8;
      color: #d8dce3; border-radius: 4px; cursor: pointer; font-size: 0.875rem;
      backdrop-filter: blur(10px); transition: all 0.3s;
    `;
    renderModeBtn.addEventListener('click', () => this.game.toggleRenderMode());
    
    // Right: journal button
    const journalBtn = document.createElement('button');
    journalBtn.id = 'hud-journal';
    journalBtn.textContent = '📖';
    journalBtn.style.cssText = renderModeBtn.style.cssText + 'width: 44px; height: 44px; font-size: 1.25rem;';
    journalBtn.addEventListener('click', () => this.toggleJournal());
    
    topBar.appendChild(renderModeBtn);
    topBar.appendChild(journalBtn);
    
    // Bottom: interaction prompt
    const promptContainer = document.createElement('div');
    promptContainer.id = 'interaction-prompt';
    promptContainer.style.cssText = `
      position: absolute; bottom: 20%; left: 50%; transform: translateX(-50%);
      padding: 0.75rem 1.5rem; background: rgba(26,29,36,0.9); border: 1px solid #8ba4b8;
      border-radius: 4px; font-size: 1rem; color: #d8dce3; opacity: 0; visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s; pointer-events: none; white-space: nowrap;
    `;
    
    // Hint display
    const hintContainer = document.createElement('div');
    hintContainer.id = 'hint-display';
    hintContainer.style.cssText = `
      position: absolute; bottom: 35%; left: 50%; transform: translateX(-50%);
      max-width: 80%; padding: 1rem 1.5rem; background: rgba(139,164,184,0.15); border: 1px solid #8ba4b8;
      border-radius: 4px; font-size: 0.9rem; color: #c9d4db; opacity: 0; visibility: hidden;
      transition: opacity 0.5s, visibility 0.5s; pointer-events: none; text-align: center;
      backdrop-filter: blur(10px);
    `;
    
    hud.appendChild(topBar);
    hud.appendChild(promptContainer);
    hud.appendChild(hintContainer);
    
    this.elements.hud = hud;
    this.elements.renderModeBtn = renderModeBtn;
    this.elements.promptContainer = promptContainer;
    this.elements.hintContainer = hintContainer;
    parent.appendChild(hud);
  }
  
  private createJournal(parent: HTMLElement): void {
    const journal = document.createElement('div');
    journal.id = 'journal';
    journal.style.cssText = `
      position: absolute; inset: 0; display: none; flex-direction: column;
      background: rgba(26, 29, 36, 0.98); backdrop-filter: blur(20px);
      pointer-events: auto; z-index: 150; overflow: hidden;
    `;
    
    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex; justify-content: space-between; align-items: center;
      padding: 1.5rem 2rem; border-bottom: 1px solid #2d3340;
    `;
    
    const title = document.createElement('h2');
    title.textContent = this.t('journal');
    title.style.cssText = `font-size: 1.5rem; font-weight: 200; letter-spacing: 0.1em; text-transform: uppercase; color: #8ba4b8; margin: 0;`;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      width: 40px; height: 40px; border-radius: 50%; border: 1px solid #4a5a6a;
      background: transparent; color: #8ba4b8; cursor: pointer; font-size: 1.25rem;
      transition: all 0.2s;
    `;
    closeBtn.addEventListener('click', () => this.toggleJournal());
    closeBtn.addEventListener('mouseenter', () => closeBtn.style.cssText += 'background: #4a5a6a;');
    closeBtn.addEventListener('mouseleave', () => closeBtn.style.cssText = closeBtn.style.cssText.replace('background: #4a5a6a;', ''));
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    // Tabs
    const tabs = document.createElement('div');
    tabs.style.cssText = `display: flex; gap: 0.5rem; padding: 1rem 2rem; border-bottom: 1px solid #2d3340;`;
    
    const tabTypes = ['symbols', 'phrases', 'patterns', 'hints', 'observations'] as const;
    const tabButtons: Record<string, HTMLButtonElement> = {};
    
    for (const type of tabTypes) {
      const btn = document.createElement('button');
      btn.textContent = this.t(type);
      btn.dataset.type = type;
      btn.style.cssText = `
        padding: 0.5rem 1rem; background: transparent; border: 1px solid transparent;
        color: #6b7a8a; cursor: pointer; font-size: 0.875rem; text-transform: uppercase;
        letter-spacing: 0.05em; transition: all 0.2s; border-radius: 4px;
      `;
      btn.addEventListener('click', () => this.switchJournalTab(type));
      tabButtons[type] = btn;
      tabs.appendChild(btn);
    }
    
    // Content
    const content = document.createElement('div');
    content.id = 'journal-content';
    content.style.cssText = `flex: 1; overflow-y: auto; padding: 1.5rem 2rem;`;
    
    journal.appendChild(header);
    journal.appendChild(tabs);
    journal.appendChild(content);
    
    this.elements.journal = journal;
    this.elements.journalTabs = tabButtons;
    this.elements.journalContent = content;
    this.currentJournalTab = 'symbols';
    parent.appendChild(journal);
  }
  
  private currentJournalTab = 'symbols';
  
  private switchJournalTab(tab: string): void {
    this.currentJournalTab = tab;
    const tabs = this.elements.journalTabs as Record<string, HTMLButtonElement>;
    for (const [type, btn] of Object.entries(tabs)) {
      if (type === tab) {
        btn.style.cssText = btn.style.cssText + 'background: #8ba4b8; color: #1a1d24; border-color: #8ba4b8;';
      } else {
        btn.style.cssText = `
          padding: 0.5rem 1rem; background: transparent; border: 1px solid transparent;
          color: #6b7a8a; cursor: pointer; font-size: 0.875rem; text-transform: uppercase;
          letter-spacing: 0.05em; transition: all 0.2s; border-radius: 4px;
        `;
      }
    }
    this.renderJournalContent();
  }
  
  private renderJournalContent(): void {
    const content = this.elements.journalContent;
    // This would be populated with actual journal entries
    content.innerHTML = `<div style="color: #6b7a8a; text-align: center; padding: 3rem;">${this.t('empty')}</div>`;
  }
  
  private createSettings(parent: HTMLElement): void {
    const settings = document.createElement('div');
    settings.id = 'settings';
    settings.style.cssText = `
      position: absolute; inset: 0; display: none; flex-direction: column;
      align-items: center; justify-content: center; gap: 1.5rem;
      background: rgba(26, 29, 36, 0.98); backdrop-filter: blur(20px);
      pointer-events: auto; z-index: 150; overflow-y: auto; padding: 2rem;
    `;
    
    const header = document.createElement('div');
    header.style.cssText = `display: flex; justify-content: space-between; width: 100%; max-width: 500px; margin-bottom: 2rem;`;
    
    const title = document.createElement('h2');
    title.textContent = this.t('settings');
    title.style.cssText = `font-size: 1.5rem; font-weight: 200; letter-spacing: 0.1em; text-transform: uppercase; color: #8ba4b8; margin: 0;`;
    
    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.style.cssText = `
      width: 40px; height: 40px; border-radius: 50%; border: 1px solid #4a5a6a;
      background: transparent; color: #8ba4b8; cursor: pointer; font-size: 1.25rem;
    `;
    closeBtn.addEventListener('click', () => this.showSettings(false));
    
    header.appendChild(title);
    header.appendChild(closeBtn);
    
    const form = document.createElement('div');
    form.style.cssText = `display: flex; flex-direction: column; gap: 1.5rem; width: 100%; max-width: 500px;`;
    
    // Settings fields
    const fields = [
      { key: 'renderMode', label: this.t('renderMode'), type: 'select', options: [
        { value: 'dream', label: 'Dream (3D)' },
        { value: 'symbols', label: 'Symbols' }
      ]},
      { key: 'quality', label: this.t('quality'), type: 'select', options: [
        { value: 'auto', label: 'Auto' },
        { value: 'low', label: 'Low' },
        { value: 'medium', label: 'Medium' },
        { value: 'high', label: 'High' }
      ]},
      { key: 'masterVolume', label: this.t('masterVolume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'musicVolume', label: this.t('musicVolume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'ambientVolume', label: this.t('ambientVolume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'sfxVolume', label: this.t('sfxVolume'), type: 'range', min: 0, max: 1, step: 0.05 },
      { key: 'mouseSensitivity', label: this.t('mouseSensitivity'), type: 'range', min: 0.0005, max: 0.005, step: 0.0001 },
      { key: 'touchSensitivity', label: this.t('touchSensitivity'), type: 'range', min: 0.001, max: 0.01, step: 0.0005 },
      { key: 'invertY', label: this.t('invertY'), type: 'checkbox' },
      { key: 'reducedMotion', label: this.t('reducedMotion'), type: 'checkbox' },
      { key: 'highContrast', label: this.t('highContrast'), type: 'checkbox' },
      { key: 'language', label: this.t('language'), type: 'select', options: [
        { value: 'en', label: 'English' },
        { value: 'ru', label: 'Русский' }
      ]}
    ];
    
    for (const field of fields) {
      const wrapper = document.createElement('div');
      wrapper.style.cssText = 'display: flex; flex-direction: column; gap: 0.5rem;';
      
      const label = document.createElement('label');
      label.textContent = field.label;
      label.style.cssText = 'font-size: 0.875rem; color: #8ba4b8; text-transform: uppercase; letter-spacing: 0.05em;';
      
      let input: HTMLElement;
      
      if (field.type === 'select') {
        const selectInput = document.createElement('select');
        selectInput.style.cssText = 'padding: 0.75rem; background: #1a1d24; border: 1px solid #2d3340; color: #d8dce3; border-radius: 4px; font-size: 1rem;';
        for (const opt of field.options!) {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          selectInput.appendChild(option);
        }
        input = selectInput;
      } else if (field.type === 'range') {
        const rangeInput = document.createElement('input');
        rangeInput.type = 'range';
        rangeInput.min = String(field.min!);
        rangeInput.max = String(field.max!);
        rangeInput.step = String(field.step!);
        rangeInput.style.cssText = 'width: 100%; accent-color: #8ba4b8;';
        input = rangeInput;
      } else if (field.type === 'checkbox') {
        const labelWrap = document.createElement('label');
        labelWrap.style.cssText = 'display: flex; align-items: center; gap: 0.75rem; cursor: pointer;';
        const checkboxInput = document.createElement('input');
        checkboxInput.type = 'checkbox';
        checkboxInput.style.cssText = 'width: 20px; height: 20px; accent-color: #8ba4b8;';
        input = checkboxInput;
        labelWrap.appendChild(input);
        labelWrap.appendChild(document.createTextNode(field.label));
        wrapper.appendChild(labelWrap);
        input = labelWrap; // Use wrapper as input for event handling
      }
      
      if (input && field.type !== 'checkbox') {
        wrapper.appendChild(label);
        wrapper.appendChild(input);
      }
      
      if (input) {
        input.addEventListener('change', () => {
          const value = field.type === 'checkbox' 
            ? (input as HTMLInputElement).checked 
            : (input as HTMLSelectElement | HTMLInputElement).value;
          this.emit('settingsChanged', { [field.key]: value } as Partial<SettingsData>);
        });
        this.elements[`setting-${field.key}`] = input;
      }
      
      form.appendChild(wrapper);
    }
    
    settings.appendChild(header);
    settings.appendChild(form);
    
    this.elements.settings = settings;
    parent.appendChild(settings);
  }
  
  private createTransitionOverlay(parent: HTMLElement): void {
    const overlay = document.createElement('div');
    overlay.id = 'transition-overlay';
    overlay.style.cssText = `
      position: absolute; inset: 0; display: none; align-items: center; justify-content: center;
      background: #1a1d24; z-index: 300; opacity: 0; transition: opacity 1s;
    `;
    
    const text = document.createElement('div');
    text.id = 'transition-text';
    text.style.cssText = `
      font-size: clamp(1.5rem, 4vw, 3rem); font-weight: 100; letter-spacing: 0.2em;
      text-transform: uppercase; color: #8ba4b8; opacity: 0; transition: opacity 0.5s;
    `;
    
    overlay.appendChild(text);
    this.elements.transitionOverlay = overlay;
    this.elements.transitionText = text;
    parent.appendChild(overlay);
  }
  
  private bindEvents(): void {
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      if (e.key === 'Escape') {
        if (this.state.journalVisible) this.toggleJournal();
        else if (this.state.settingsVisible) this.showSettings(false);
        else if (this.state.pauseMenuVisible) this.hidePauseMenu();
        else this.showPauseMenu();
      }
    });
  }
  
  async init(): Promise<void> {
    // Load saved settings
    this.loadSettings();
  }
  
  private loadSettings(): void {
    const saved = localStorage.getItem('dreamscape_settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved) as SettingsData;
        this.applySettingsToUI(settings);
      } catch {}
    }
  }
  
  private applySettingsToUI(settings: SettingsData): void {
    for (const [key, value] of Object.entries(settings)) {
      const el = this.elements[`setting-${key}`];
      if (el) {
        if (el instanceof HTMLSelectElement) el.value = value as string;
        else if (el instanceof HTMLInputElement && el.type === 'range') el.value = String(value);
        else if (el instanceof HTMLInputElement && el.type === 'checkbox') el.checked = value as boolean;
      }
    }
    this.reducedMotion = settings.reducedMotion;
    this.highContrast = settings.highContrast;
    this.language = settings.language;
  }
  
  update(dt: number): void {
    // Update any animated UI elements
  }
  
  onResize(width: number, height: number): void {
    // Handle resize if needed
  }
  
  // Public methods
  showMainMenu(mode: GameMode): void {
    this.state.mainMenuVisible = true;
    this.elements.mainMenu.style.display = 'flex';
    this.elements.mainMenu.style.opacity = '1';
    this.elements.mainMenu.style.visibility = 'visible';
    
    // Show/hide continue button
    const continueBtn = this.elements['btn-continue'];
    if (continueBtn) {
      continueBtn.style.display = this.hasSaveData() ? 'block' : 'none';
    }
  }
  
  hideMainMenu(): void {
    this.state.mainMenuVisible = false;
    if (this.elements.mainMenu) {
      gsap.to(this.elements.mainMenu, { opacity: 0, duration: 0.3, onComplete: () => {
        this.elements.mainMenu.style.display = 'none';
        this.elements.mainMenu.style.visibility = 'hidden';
      }});
    }
  }
  
  showPauseMenu(): void {
    if (this.state.mainMenuVisible) return;
    this.state.pauseMenuVisible = true;
    if (this.elements.pauseMenu) {
      this.elements.pauseMenu.style.display = 'flex';
      gsap.fromTo(this.elements.pauseMenu, { opacity: 0 }, { opacity: 1, duration: 0.2 });
    }
  }
  
  hidePauseMenu(): void {
    this.state.pauseMenuVisible = false;
    if (this.elements.pauseMenu) {
      gsap.to(this.elements.pauseMenu, { opacity: 0, duration: 0.2, onComplete: () => {
        this.elements.pauseMenu.style.display = 'none';
      }});
    }
  }
  
  isMenuOpen(): boolean {
    return this.state.mainMenuVisible || this.state.pauseMenuVisible || this.state.settingsVisible || this.state.journalVisible;
  }
  
  toggleJournal(): void {
    this.state.journalVisible = !this.state.journalVisible;
    if (this.state.journalVisible && this.elements.journal) {
      this.elements.journal.style.display = 'flex';
      gsap.fromTo(this.elements.journal, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      this.renderJournalContent();
    } else if (this.elements.journal) {
      gsap.to(this.elements.journal, { opacity: 0, duration: 0.2, onComplete: () => {
        this.elements.journal.style.display = 'none';
      }});
    }
  }
  
  showSettings(show: boolean): void {
    this.state.settingsVisible = show;
    if (this.elements.settings) {
      if (show) {
        this.elements.settings.style.display = 'flex';
        gsap.fromTo(this.elements.settings, { opacity: 0 }, { opacity: 1, duration: 0.3 });
      } else {
        gsap.to(this.elements.settings, { opacity: 0, duration: 0.2, onComplete: () => {
          this.elements.settings.style.display = 'none';
        }});
      }
    }
  }
  
  showInteractionPrompt(prompt: InteractionPrompt): void {
    this.state.currentPrompt = prompt;
    const container = this.elements.promptContainer;
    if (container) {
      container.textContent = prompt.message;
      container.style.opacity = '1';
      container.style.visibility = 'visible';
    }
  }
  
  hideInteractionPrompt(): void {
    this.state.currentPrompt = null;
    const container = this.elements.promptContainer;
    if (container) {
      gsap.to(container, { opacity: 0, duration: 0.2, onComplete: () => {
        container.style.visibility = 'hidden';
      }});
    }
  }
  
  showHint(hint: { content: string; tier: number }): void {
    this.state.currentHint = hint;
    const container = this.elements.hintContainer;
    if (container) {
      container.textContent = hint.content;
      container.style.opacity = '1';
      container.style.visibility = 'visible';
    }
    
    // Auto-hide after delay
    setTimeout(() => this.hideHint(), 8000);
  }
  
  hideHint(): void {
    this.state.currentHint = null;
    const container = this.elements.hintContainer;
    if (container) {
      gsap.to(container, { opacity: 0, duration: 0.5, onComplete: () => {
        container.style.visibility = 'hidden';
      }});
    }
  }
  
  showPuzzleSolved(puzzleId: string): void {
    // Could show a subtle notification
    this.showHint({ content: 'Path unlocked', tier: 1 });
  }
  
  showTransition(type: string): void {
    const overlay = this.elements.transitionOverlay;
    const text = this.elements.transitionText;
    if (!overlay || !text) return;
    
    const typeNames: Record<string, string> = {
      door: 'Through the Door',
      stairs: 'Ascending',
      bridge: 'Crossing',
      tunnel: 'Through the Tunnel',
      fog: 'Into the Mist',
      window: 'Through the Window',
      lift: 'Rising',
      rift: 'Between Worlds'
    };
    
    text.textContent = typeNames[type] || 'Transition';
    text.style.opacity = '0';
    overlay.style.display = 'flex';
    
    gsap.to(overlay, { opacity: 1, duration: 0.5 });
    gsap.to(text, { opacity: 1, duration: 0.5, delay: 0.3 });
    
    setTimeout(() => {
      gsap.to(text, { opacity: 0, duration: 0.3 });
      setTimeout(() => {
        gsap.to(overlay, { opacity: 0, duration: 0.5, onComplete: () => {
          overlay.style.display = 'none';
        }});
      }, 1000);
    }, 2000);
  }
  
  updateRenderModeButton(mode: RenderMode): void {
    const btn = this.elements.renderModeBtn;
    if (btn) {
      btn.textContent = mode === 'dream' ? '◈ Dream' : '◆ Symbols';
    }
  }
  
  addJournalEntry(entry: JournalEntry): void {
    // Journal entry added - would update journal content if visible
    console.log('Journal entry:', entry.content);
  }
  
  setReducedMotion(enabled: boolean): void {
    this.reducedMotion = enabled;
    document.documentElement.style.setProperty('--transition-duration', enabled ? '0s' : '0.3s');
  }
  
  setHighContrast(enabled: boolean): void {
    this.highContrast = enabled;
    document.documentElement.classList.toggle('high-contrast', enabled);
  }
  
  setLanguage(lang: 'en' | 'ru'): void {
    this.language = lang;
    this.updateUITexts();
  }
  
  getReducedMotion(): boolean { return this.reducedMotion; }
  getHighContrast(): boolean { return this.highContrast; }
  getLanguage(): 'en' | 'ru' { return this.language; }
  
  private t(key: string): string {
    return this.texts[this.language][key as keyof typeof this.texts.en] || key;
  }
  
  private updateUITexts(): void {
    // Update all UI texts based on current language
    // This is a simplified version - in practice would update all elements
  }
  
  private hasSaveData(): boolean {
    return !!localStorage.getItem('dreamscape_save');
  }
  
  showAbout(): void {
    alert('DREAMSCAPE v1.0\nA surreal exploration game with dual rendering modes.\n\nCreated for the DREAMSCAPE test specification.');
  }
  
  reset(): void {
    this.hideInteractionPrompt();
    this.hideHint();
    this.state.journalVisible = false;
    this.elements.journal.style.display = 'none';
  }
  
  restore(settings: SettingsData): void {
    this.applySettingsToUI(settings);
  }
  
  dispose(): void {
    // Clean up
    for (const el of Object.values(this.elements)) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }
}