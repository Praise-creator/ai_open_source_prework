class GameClient {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.worldImage = null;
        this.worldWidth = 2048;
        this.worldHeight = 2048;
        
        // Game state
        this.players = new Map();
        this.avatars = new Map();
        this.myPlayerId = null;
        this.myPlayer = null;
        this.playerEmotes = new Map(); // Track which players are emoting
        
        // Viewport system
        this.cameraX = 0;
        this.cameraY = 0;
        this.viewportWidth = 0;
        this.viewportHeight = 0;
        
        // WebSocket
        this.ws = null;
        this.serverUrl = 'wss://codepath-mmorg.onrender.com';
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.loadWorldMap();
        this.setupEventListeners();
        this.connectToServer();
    }

    setupCanvas() {
        // Set canvas size to fill the browser window
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.viewportWidth = this.canvas.width;
        this.viewportHeight = this.canvas.height;
        
        // Handle window resize
        window.addEventListener('resize', () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
            this.viewportWidth = this.canvas.width;
            this.viewportHeight = this.canvas.height;
            this.updateViewport();
            this.render();
        });
    }

    loadWorldMap() {
        this.worldImage = new Image();
        this.worldImage.onload = () => {
            console.log('World map loaded successfully');
            this.render();
        };
        this.worldImage.onerror = () => {
            console.error('Failed to load world map');
        };
        this.worldImage.src = 'world.jpg';
    }

    connectToServer() {
        try {
            this.ws = new WebSocket(this.serverUrl);
            
            this.ws.onopen = () => {
                console.log('Connected to game server');
                this.joinGame();
            };
            
            this.ws.onmessage = (event) => {
                try {
                    const message = JSON.parse(event.data);
                    this.handleServerMessage(message);
                } catch (error) {
                    console.error('Error parsing server message:', error);
                }
            };
            
            this.ws.onclose = () => {
                console.log('Disconnected from game server');
                // Attempt to reconnect after 3 seconds
                setTimeout(() => {
                    console.log('Attempting to reconnect...');
                    this.connectToServer();
                }, 3000);
            };
            
            this.ws.onerror = (error) => {
                console.error('WebSocket error:', error);
            };
        } catch (error) {
            console.error('Failed to connect to server:', error);
        }
    }

    joinGame() {
        const joinMessage = {
            action: 'join_game',
            username: 'Praise'
        };
        
        this.ws.send(JSON.stringify(joinMessage));
        console.log('Sent join game message');
    }

    handleServerMessage(message) {
        console.log('Received message:', message);
        
        switch (message.action) {
            case 'join_game':
                if (message.success) {
                    this.handleJoinGameSuccess(message);
                } else {
                    console.error('Join game failed:', message.error);
                }
                break;
                
            case 'player_joined':
                this.handlePlayerJoined(message);
                break;
                
            case 'players_moved':
                this.handlePlayersMoved(message);
                break;
                
            case 'player_left':
                this.handlePlayerLeft(message);
                break;
                
            case 'emote':
                this.handlePlayerEmote(message);
                break;
                
            default:
                console.log('Unknown message type:', message.action);
        }
    }

    handleJoinGameSuccess(message) {
        this.myPlayerId = message.playerId;
        
        // Store all players
        for (const [playerId, playerData] of Object.entries(message.players)) {
            this.players.set(playerId, playerData);
        }
        
        // Store all avatars
        for (const [avatarName, avatarData] of Object.entries(message.avatars)) {
            this.avatars.set(avatarName, avatarData);
        }
        
        // Set my player reference
        this.myPlayer = this.players.get(this.myPlayerId);
        
        // Center viewport on my avatar
        this.centerViewportOnPlayer();
        
        // Load avatar images
        this.loadAvatarImages();
        
        console.log('Successfully joined game as:', this.myPlayer.username);
        this.render();
    }

    handlePlayerJoined(message) {
        this.players.set(message.player.id, message.player);
        this.avatars.set(message.avatar.name, message.avatar);
        this.loadAvatarImage(message.avatar);
        this.render();
    }

    handlePlayersMoved(message) {
        for (const [playerId, playerData] of Object.entries(message.players)) {
            this.players.set(playerId, playerData);
            
            // Update viewport if my player moved
            if (playerId === this.myPlayerId) {
                this.myPlayer = playerData;
                this.centerViewportOnPlayer();
            }
        }
        this.render();
    }

    handlePlayerLeft(message) {
        this.players.delete(message.playerId);
        this.playerEmotes.delete(message.playerId);
        this.render();
    }

    handlePlayerEmote(message) {
        const playerId = message.playerId;
        const emoteType = message.emote;
        
        // Start the emote animation
        this.startEmoteAnimation(playerId, emoteType);
        this.render();
    }

    startEmoteAnimation(playerId, emoteType) {
        if (emoteType === 'jump') {
            this.playerEmotes.set(playerId, {
                type: 'jump',
                startTime: Date.now(),
                duration: 1500, // 1.5 seconds
                bounces: 3
            });
            
            // Auto-remove emote after duration
            setTimeout(() => {
                this.playerEmotes.delete(playerId);
                this.render();
            }, 1500);
        }
    }

    // Viewport and coordinate transformation methods
    centerViewportOnPlayer() {
        if (!this.myPlayer) return;
        
        this.cameraX = this.myPlayer.x - this.viewportWidth / 2;
        this.cameraY = this.myPlayer.y - this.viewportHeight / 2;
        this.updateViewport();
    }

    updateViewport() {
        // Clamp camera position to world boundaries
        this.cameraX = Math.max(0, Math.min(this.cameraX, this.worldWidth - this.viewportWidth));
        this.cameraY = Math.max(0, Math.min(this.cameraY, this.worldHeight - this.viewportHeight));
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.cameraX,
            y: worldY - this.cameraY
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.cameraX,
            y: screenY + this.cameraY
        };
    }

    // Avatar loading and rendering
    loadAvatarImages() {
        for (const [avatarName, avatarData] of this.avatars) {
            this.loadAvatarImage(avatarData);
        }
    }

    loadAvatarImage(avatarData) {
        const avatar = {
            name: avatarData.name,
            images: {
                north: [],
                south: [],
                east: []
            }
        };

        // Load images for each direction
        ['north', 'south', 'east'].forEach(direction => {
            avatarData.frames[direction].forEach((base64Data, index) => {
                const img = new Image();
                img.onload = () => {
                    this.render(); // Re-render when new avatar image loads
                };
                img.src = base64Data;
                avatar.images[direction].push(img);
            });
        });

        this.avatars.set(avatarData.name, avatar);
    }

    render() {
        if (!this.worldImage) return;

        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Draw world map with viewport offset
        this.ctx.drawImage(
            this.worldImage,
            this.cameraX, this.cameraY, this.viewportWidth, this.viewportHeight, // Source rectangle
            0, 0, this.viewportWidth, this.viewportHeight  // Destination rectangle
        );

        // Draw world boundaries if visible
        this.drawWorldBoundaries();

        // Draw all players
        this.drawPlayers();
    }

    drawWorldBoundaries() {
        const worldLeft = -this.cameraX;
        const worldTop = -this.cameraY;
        const worldRight = this.worldWidth - this.cameraX;
        const worldBottom = this.worldHeight - this.cameraY;

        this.ctx.strokeStyle = '#ff0000';
        this.ctx.lineWidth = 2;
        
        // Only draw boundaries if they're visible in the viewport
        if (worldLeft >= 0 && worldLeft < this.viewportWidth) {
            this.ctx.beginPath();
            this.ctx.moveTo(worldLeft, 0);
            this.ctx.lineTo(worldLeft, this.viewportHeight);
            this.ctx.stroke();
        }
        
        if (worldTop >= 0 && worldTop < this.viewportHeight) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, worldTop);
            this.ctx.lineTo(this.viewportWidth, worldTop);
            this.ctx.stroke();
        }
        
        if (worldRight >= 0 && worldRight < this.viewportWidth) {
            this.ctx.beginPath();
            this.ctx.moveTo(worldRight, 0);
            this.ctx.lineTo(worldRight, this.viewportHeight);
            this.ctx.stroke();
        }
        
        if (worldBottom >= 0 && worldBottom < this.viewportHeight) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, worldBottom);
            this.ctx.lineTo(this.viewportWidth, worldBottom);
            this.ctx.stroke();
        }
    }

    drawPlayers() {
        for (const [playerId, player] of this.players) {
            this.drawPlayer(player);
        }
    }

    drawPlayer(player) {
        const screenPos = this.worldToScreen(player.x, player.y);
        
        // Only draw if player is visible in viewport
        if (screenPos.x < -50 || screenPos.x > this.viewportWidth + 50 || 
            screenPos.y < -50 || screenPos.y > this.viewportHeight + 50) {
            return;
        }

        const avatar = this.avatars.get(player.avatar);
        if (!avatar || !avatar.images) return;

        // Get the appropriate direction and frame
        let direction = player.facing;
        if (direction === 'west') {
            direction = 'east'; // West uses flipped east frames
        }

        const frames = avatar.images[direction];
        if (!frames || frames.length === 0) return;

        const frameIndex = player.animationFrame || 0;
        const avatarImage = frames[frameIndex % frames.length];
        
        if (!avatarImage || !avatarImage.complete) return;

        // Calculate avatar size (maintain aspect ratio)
        const avatarSize = 32; // Base size
        const aspectRatio = avatarImage.width / avatarImage.height;
        const width = avatarSize;
        const height = avatarSize / aspectRatio;

        // Draw avatar
        this.ctx.save();
        
        // Flip horizontally for west direction
        if (player.facing === 'west') {
            this.ctx.scale(-1, 1);
            this.ctx.drawImage(avatarImage, -screenPos.x - width/2, screenPos.y - height/2, width, height);
        } else {
            this.ctx.drawImage(avatarImage, screenPos.x - width/2, screenPos.y - height/2, width, height);
        }
        
        this.ctx.restore();

        // Draw username label
        this.drawPlayerLabel(player.username, screenPos.x, screenPos.y - height/2 - 5);
    }

    drawPlayerLabel(username, x, y) {
        this.ctx.save();
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        this.ctx.fillRect(x - username.length * 3, y - 12, username.length * 6, 14);
        
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '12px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(username, x, y);
        this.ctx.restore();
    }

    setupEventListeners() {
        // Add click-to-move functionality
        this.canvas.addEventListener('click', (event) => {
            const rect = this.canvas.getBoundingClientRect();
            const screenX = event.clientX - rect.left;
            const screenY = event.clientY - rect.top;
            
            // Convert screen coordinates to world coordinates
            const worldPos = this.screenToWorld(screenX, screenY);
            
            // Only handle clicks within the world boundaries
            if (worldPos.x >= 0 && worldPos.x <= this.worldWidth && 
                worldPos.y >= 0 && worldPos.y <= this.worldHeight) {
                console.log(`Clicked at world coordinates: (${Math.round(worldPos.x)}, ${Math.round(worldPos.y)})`);
                this.sendMoveCommand(worldPos.x, worldPos.y);
            }
        });

        // Add keyboard movement
        document.addEventListener('keydown', (event) => {
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
            
            let direction = null;
            switch(event.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    direction = 'up';
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    direction = 'down';
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    direction = 'left';
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    direction = 'right';
                    break;
                case '1':
                    this.sendEmoteCommand('jump');
                    return; // Don't process as movement
            }
            
            if (direction) {
                event.preventDefault();
                this.sendMoveCommand(direction);
            }
        });
    }

    sendMoveCommand(x, y) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        let message;
        if (typeof x === 'string') {
            // Keyboard movement
            message = {
                action: 'move',
                direction: x
            };
        } else {
            // Click-to-move
            message = {
                action: 'move',
                x: Math.round(x),
                y: Math.round(y)
            };
        }
        
        this.ws.send(JSON.stringify(message));
    }

    sendEmoteCommand(emoteType) {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
        
        const message = {
            action: 'emote',
            emote: emoteType,
            playerId: this.myPlayerId
        };
        
        this.ws.send(JSON.stringify(message));
        console.log(`Sent emote: ${emoteType}`);
    }
}

// Initialize the game when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new GameClient();
});
