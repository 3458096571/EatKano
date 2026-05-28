/**
 * 星星空音游 - Starlight Rhythm Game
 * Based on EatKano with visual enhancements
 */

(function() {
    'use strict';

    // ========================================
    // Configuration
    // ========================================
    const CONFIG = {
        gameDuration: 60,
        blockSpawnInterval: 800,
        blockLifetime: 2000,
        maxBlocks: 5,
        hitFxDuration: 750, // 0.75 seconds
        hitFxColumns: 7,
        hitFxRows: 6,
        hitFxTotalFrames: 42,
        starfieldParticles: 80
    };

    // ========================================
    // Game State
    // ========================================
    let gameState = {
        score: 0,
        timeLeft: CONFIG.gameDuration,
        isPlaying: false,
        timerInterval: null,
        spawnInterval: null,
        currentPreset: 1,
        blocks: []
    };

    // ========================================
    // DOM Elements
    // ========================================
    const elements = {
        bgCanvas: document.getElementById('bgCanvas'),
        welcome: document.getElementById('welcome'),
        game: document.getElementById('game'),
        end: document.getElementById('end'),
        startBtn: document.getElementById('startBtn'),
        restartBtn: document.getElementById('restartBtn'),
        homeBtn: document.getElementById('homeBtn'),
        score: document.getElementById('score'),
        timer: document.getElementById('timer'),
        finalScore: document.getElementById('finalScore'),
        rank: document.getElementById('rank'),
        gameArea: document.getElementById('gameArea'),
        hitFxContainer: document.getElementById('hitFxContainer'),
        presetOptions: document.querySelectorAll('.preset-option')
    };

    // ========================================
    // Audio Manager
    // ========================================
    const audioManager = {
        sounds: {},
        
        init() {
            this.sounds = {
                tap: new Audio('static/music/tap.mp3'),
                err: new Audio('static/music/err.mp3'),
                end: new Audio('static/music/end.mp3')
            };
            
            // Preload all sounds
            Object.values(this.sounds).forEach(sound => {
                sound.load();
            });
        },
        
        play(name) {
            if (this.sounds[name]) {
                const sound = this.sounds[name].cloneNode();
                sound.volume = 0.5;
                sound.play().catch(() => {});
            }
        }
    };

    // ========================================
    // Starfield Background (Canvas Particle System)
    // ========================================
    const starfield = {
        canvas: null,
        ctx: null,
        particles: [],
        animationId: null,

        init() {
            this.canvas = elements.bgCanvas;
            this.ctx = this.canvas.getContext('2d');
            this.resize();
            this.createParticles();
            this.animate();
            
            window.addEventListener('resize', () => this.resize());
        },

        resize() {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        },

        createParticles() {
            this.particles = [];
            for (let i = 0; i < CONFIG.starfieldParticles; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    radius: Math.random() * 2 + 0.5,
                    alpha: Math.random() * 0.5 + 0.3,
                    speed: Math.random() * 0.3 + 0.1,
                    twinkleSpeed: Math.random() * 0.02 + 0.01,
                    twinklePhase: Math.random() * Math.PI * 2
                });
            }
        },

        animate() {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw gradient background
            const gradient = this.ctx.createRadialGradient(
                this.canvas.width / 2, this.canvas.height / 2, 0,
                this.canvas.width / 2, this.canvas.height / 2, this.canvas.width
            );
            gradient.addColorStop(0, '#16213e');
            gradient.addColorStop(0.5, '#0a0a1a');
            gradient.addColorStop(1, '#050510');
            this.ctx.fillStyle = gradient;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            
            // Draw and update particles
            this.particles.forEach(p => {
                // Update position (slow movement)
                p.y -= p.speed;
                if (p.y < -10) {
                    p.y = this.canvas.height + 10;
                    p.x = Math.random() * this.canvas.width;
                }
                
                // Twinkle effect
                p.twinklePhase += p.twinkleSpeed;
                const twinkle = Math.sin(p.twinklePhase) * 0.3 + 0.7;
                
                // Draw star with glow
                const alpha = p.alpha * twinkle;
                
                // Outer glow
                const glowGradient = this.ctx.createRadialGradient(
                    p.x, p.y, 0,
                    p.x, p.y, p.radius * 4
                );
                glowGradient.addColorStop(0, `rgba(0, 210, 255, ${alpha * 0.3})`);
                glowGradient.addColorStop(1, 'rgba(0, 210, 255, 0)');
                this.ctx.fillStyle = glowGradient;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius * 4, 0, Math.PI * 2);
                this.ctx.fill();
                
                // Core
                this.ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
                this.ctx.beginPath();
                this.ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                this.ctx.fill();
            });
            
            this.animationId = requestAnimationFrame(() => this.animate());
        }
    };

    // ========================================
    // Hit FX Sprite Animation
    // ========================================
    const hitFxManager = {
        /**
         * Play hit effect sprite animation at position
         * @param {number} x - X position
         * @param {number} y - Y position
         */
        play(x, y) {
            const sprite = document.createElement('div');
            sprite.className = 'hit-fx-sprite';
            sprite.style.left = `${x - 60}px`; // Center the 120px sprite
            sprite.style.top = `${y - 60}px`;
            
            elements.hitFxContainer.appendChild(sprite);
            
            // Animate through sprite sheet frames
            let frame = 0;
            const frameDuration = CONFIG.hitFxDuration / CONFIG.hitFxTotalFrames;
            
            const animateFrame = () => {
                if (frame >= CONFIG.hitFxTotalFrames) {
                    sprite.remove();
                    return;
                }
                
                const col = frame % CONFIG.hitFxColumns;
                const row = Math.floor(frame / CONFIG.hitFxColumns);
                
                sprite.style.backgroundPosition = `-${col * 100}% -${row * 100}%`;
                
                frame++;
                setTimeout(animateFrame, frameDuration);
            };
            
            animateFrame();
        }
    };

    // ========================================
    // Block Manager
    // ========================================
    const blockManager = {
        /**
         * Get random preset image URL
         */
        getRandomPresetImage() {
            const preset = Math.floor(Math.random() * 4) + 1;
            return `static/image/ClickBefore_${preset}.png`;
        },
        
        /**
         * Get current preset image URL
         */
        getCurrentPresetImage() {
            return `static/image/ClickBefore_${gameState.currentPreset}.png`;
        },

        /**
         * Create a new game block
         */
        createBlock() {
            const gameArea = elements.gameArea;
            const areaRect = gameArea.getBoundingClientRect();
            
            // Random position within game area
            const blockSize = 80;
            const maxX = gameArea.offsetWidth - blockSize;
            const maxY = gameArea.offsetHeight - blockSize;
            
            const x = Math.random() * maxX;
            const y = Math.random() * maxY;
            
            // Create block element
            const block = document.createElement('div');
            block.className = 'block';
            block.style.left = `${x}px`;
            block.style.top = `${y}px`;
            block.style.backgroundImage = `url('${this.getRandomPresetImage()}')`;
            
            // Store block data
            const blockData = {
                element: block,
                x: x,
                y: y,
                createdAt: Date.now(),
                hit: false
            };
            
            // Click handler
            block.addEventListener('click', (e) => {
                e.stopPropagation();
                if (!blockData.hit && gameState.isPlaying) {
                    this.hitBlock(blockData, e.clientX, e.clientY);
                }
            });
            
            // Touch handler for mobile
            block.addEventListener('touchstart', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (!blockData.hit && gameState.isPlaying) {
                    const touch = e.touches[0];
                    this.hitBlock(blockData, touch.clientX, touch.clientY);
                }
            });
            
            gameArea.appendChild(block);
            gameState.blocks.push(blockData);
            
            // Auto-remove after lifetime
            setTimeout(() => {
                if (!blockData.hit) {
                    this.missBlock(blockData);
                }
            }, CONFIG.blockLifetime);
        },

        /**
         * Handle successful block hit
         */
        hitBlock(blockData, clientX, clientY) {
            blockData.hit = true;
            
            // Update score
            gameState.score += 10;
            elements.score.textContent = gameState.score;
            
            // Play sound
            audioManager.play('tap');
            
            // Play hit FX sprite animation
            hitFxManager.play(clientX, clientY);
            
            // Create hit effect element
            const hitEffect = document.createElement('div');
            hitEffect.className = `block-hit tt${Math.floor(Math.random() * 5) + 1}`;
            hitEffect.style.left = blockData.element.style.left;
            hitEffect.style.top = blockData.element.style.top;
            hitEffect.style.backgroundImage = blockData.element.style.backgroundImage;
            elements.gameArea.appendChild(hitEffect);
            
            // Remove block
            blockData.element.style.transform = 'scale(0)';
            setTimeout(() => {
                blockData.element.remove();
                hitEffect.remove();
            }, 150);
            
            // Remove from array
            const index = gameState.blocks.indexOf(blockData);
            if (index > -1) {
                gameState.blocks.splice(index, 1);
            }
        },

        /**
         * Handle missed block
         */
        missBlock(blockData) {
            if (blockData.hit) return;
            
            // Play error sound
            audioManager.play('err');
            
            // Fade out
            blockData.element.style.opacity = '0';
            blockData.element.style.transform = 'scale(0.5)';
            
            setTimeout(() => {
                blockData.element.remove();
            }, 300);
            
            // Remove from array
            const index = gameState.blocks.indexOf(blockData);
            if (index > -1) {
                gameState.blocks.splice(index, 1);
            }
        },

        /**
         * Clear all blocks
         */
        clearAll() {
            gameState.blocks.forEach(block => {
                block.element.remove();
            });
            gameState.blocks = [];
        }
    };

    // ========================================
    // Game Controller
    // ========================================
    const gameController = {
        /**
         * Start the game
         */
        start() {
            // Reset state
            gameState.score = 0;
            gameState.timeLeft = CONFIG.gameDuration;
            gameState.isPlaying = true;
            
            // Update UI
            elements.score.textContent = '0';
            elements.timer.textContent = CONFIG.gameDuration;
            
            // Show game screen
            elements.welcome.classList.add('hidden');
            elements.end.classList.add('hidden');
            elements.game.classList.remove('hidden');
            
            // Start timer
            gameState.timerInterval = setInterval(() => {
                gameState.timeLeft--;
                elements.timer.textContent = gameState.timeLeft;
                
                if (gameState.timeLeft <= 0) {
                    this.end();
                }
            }, 1000);
            
            // Start spawning blocks
            gameState.spawnInterval = setInterval(() => {
                if (gameState.blocks.length < CONFIG.maxBlocks) {
                    blockManager.createBlock();
                }
            }, CONFIG.blockSpawnInterval);
            
            // Spawn initial blocks
            for (let i = 0; i < 3; i++) {
                setTimeout(() => blockManager.createBlock(), i * 200);
            }
        },

        /**
         * End the game
         */
        end() {
            gameState.isPlaying = false;
            
            // Stop intervals
            clearInterval(gameState.timerInterval);
            clearInterval(gameState.spawnInterval);
            
            // Play end sound
            audioManager.play('end');
            
            // Clear remaining blocks
            blockManager.clearAll();
            
            // Calculate rank
            const rank = this.calculateRank(gameState.score);
            
            // Update end screen
            elements.finalScore.textContent = gameState.score;
            elements.rank.textContent = rank;
            
            // Show end screen
            elements.game.classList.add('hidden');
            elements.end.classList.remove('hidden');
        },

        /**
         * Calculate rank based on score
         */
        calculateRank(score) {
            if (score >= 500) return 'SSS';
            if (score >= 400) return 'SS';
            if (score >= 300) return 'S';
            if (score >= 200) return 'A';
            if (score >= 150) return 'B';
            if (score >= 100) return 'C';
            return 'D';
        },

        /**
         * Return to home screen
         */
        goHome() {
            elements.end.classList.add('hidden');
            elements.game.classList.add('hidden');
            elements.welcome.classList.remove('hidden');
        }
    };

    // ========================================
    // Preset Selector
    // ========================================
    function initPresetSelector() {
        elements.presetOptions.forEach(option => {
            option.addEventListener('click', () => {
                // Remove active from all
                elements.presetOptions.forEach(o => o.classList.remove('active'));
                // Add active to clicked
                option.classList.add('active');
                // Update preset
                gameState.currentPreset = parseInt(option.dataset.preset);
            });
        });
    }

    // ========================================
    // Event Listeners
    // ========================================
    function initEventListeners() {
        elements.startBtn.addEventListener('click', () => gameController.start());
        elements.restartBtn.addEventListener('click', () => gameController.start());
        elements.homeBtn.addEventListener('click', () => gameController.goHome());
        
        // Keyboard support
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                if (!elements.welcome.classList.contains('hidden')) {
                    gameController.start();
                } else if (!elements.end.classList.contains('hidden')) {
                    gameController.start();
                }
            }
        });
    }

    // ========================================
    // Initialization
    // ========================================
    function init() {
        // Initialize systems
        audioManager.init();
        starfield.init();
        initPresetSelector();
        initEventListeners();
        
        console.log('🌟 星星空音游 initialized!');
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();