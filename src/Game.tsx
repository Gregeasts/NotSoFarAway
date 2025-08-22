import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { WebRTCConnection } from './WebRTC';
import nipplejs from 'nipplejs';

type Pos = { x: number; y: number };
type GameMessage =
  | { type: 'pos'; pos: Pos }
  | { type: 'chat'; text: string; senderId: 'greg' | 'shannon' };

export default function Game({ roomId, playerId }: { roomId: string; playerId: 'greg' | 'shannon' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const joystickRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<WebRTCConnection | null>(null);

  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    const conn = new WebRTCConnection(roomId, playerId);
    conn.connect();
    connRef.current = conn;

    const bubbles: Record<'greg' | 'shannon', Phaser.GameObjects.Container | null> = { greg: null, shannon: null };
    const positions: Record<'greg' | 'shannon', Pos> = {
      greg: { x: 400, y: 300 },
      shannon: { x: 600, y: 300 }
    };
    const sprites: Record<'greg' | 'shannon', Phaser.GameObjects.Container> = { greg: null!, shannon: null! };
    const joystickDirection = { x: 0, y: 0 };

    let game: Phaser.Game | null = null;
    let joystick: nipplejs.JoystickManager | null = null;

    conn.onMessage = (data: GameMessage) => {
      if (data.type === 'pos') {
        const otherId: 'greg' | 'shannon' = playerId === 'greg' ? 'shannon' : 'greg';
        positions[otherId] = data.pos;
        sprites[otherId].setPosition(data.pos.x, data.pos.y);
      } else if (data.type === 'chat') {
        showBubble(data.senderId, data.text);
      }
    };

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: window.innerWidth,
      height: window.innerHeight,
      parent: containerRef.current!,
      backgroundColor: '#aee3ff',
      physics: { default: 'arcade' },
      scene: { preload, create, update }
    };

    function preload(this: Phaser.Scene) {}

    function create(this: Phaser.Scene) {
      const makeDragon = (color: number) => {
        const c = this.add.container(0, 0);
        const body = this.add.ellipse(0, 0, 60, 40, color);
        const head = this.add.ellipse(34, -10, 30, 22, color);
        const eye = this.add.circle(42, -12, 3, 0x000000);
        c.add([body, head, eye]);
        return c;
      };

      const myColor = playerId === 'greg' ? 0x8fd3ff : 0xffbabf;
      const otherColor = playerId === 'greg' ? 0xffbabf : 0x8fd3ff;

      // Assign sprites
      sprites[playerId] = makeDragon(myColor);
      sprites[playerId === 'greg' ? 'shannon' : 'greg'] = makeDragon(otherColor);

      // Set initial positions
      (['greg', 'shannon'] as const).forEach((id) => {
        sprites[id].setPosition(positions[id].x, positions[id].y);
      });

      // --- Joystick ---
      if (joystickRef.current) {
        joystick = nipplejs.create({
          zone: joystickRef.current,
          mode: 'static',
          position: { left: '100px', bottom: '100px' },
          color: 'blue',
          size: 100
        });

        joystick.on('move', (_evt, data) => {
          if (data && data.vector) {
            joystickDirection.x = data.vector.x;
            joystickDirection.y = data.vector.y;
          }
        });

        joystick.on('end', () => {
          joystickDirection.x = 0;
          joystickDirection.y = 0;
        });
      }
    }

    function showBubble(senderId: 'greg' | 'shannon', text: string) {
      const sprite = sprites[senderId];

      if (bubbles[senderId]) bubbles[senderId]?.destroy();

      const padding = 20;
      const maxWidth = 0;
      const scene = game!.scene.scenes[0];

      const bubbleText = scene.add.text(0, 0, text, {
        font: '14px Arial',
        color: '#000000',
        align: 'center',
        wordWrap: { width: maxWidth }
      }).setOrigin(0.5);

      const bubbleBg = scene.add.ellipse(
        0,
        0,
        bubbleText.width + padding * 2,
        bubbleText.height + padding * 2,
        0xffffff
      );
      bubbleBg.setStrokeStyle(2, 0x000000);

      const bubbleContainer = scene.add.container(sprite.x + 34, sprite.y - 40, [bubbleBg, bubbleText]);
      bubbleContainer.setDepth(1000);
      bubbleContainer.setInteractive();
      bubbleContainer.on('pointerdown', () => bubbleContainer.destroy());

      bubbles[senderId] = bubbleContainer;
    }

    function update(this: Phaser.Scene, _t: number, dt: number) {
      const speed = 200;
      let moved = false;

      const myPos = positions[playerId];
      const mySprite = sprites[playerId];

      if (joystickDirection.x !== 0 || joystickDirection.y !== 0) {
        myPos.x += joystickDirection.x * speed * dt / 1000;
        myPos.y -= joystickDirection.y * speed * dt / 1000;
        moved = true;
      }

      mySprite.setPosition(myPos.x, myPos.y);

      // Update bubbles
      (['greg', 'shannon'] as const).forEach((id) => {
        const bubble = bubbles[id];
        if (bubble) {
          const target = sprites[id];
          bubble.setPosition(target.x + 34, target.y - 40);
        }
      });

      // Send movement
      if (moved && connRef.current) {
        connRef.current.sendGameData({ type: 'pos', pos: myPos });
      }
    }

    game = new Phaser.Game(config);

    return () => {
      game?.destroy(true);
      conn.ws.close();
      joystick?.destroy();
    };
  }, [roomId, playerId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      <div
        ref={joystickRef}
        style={{
          position: 'absolute',
          bottom: 50,
          left: 0,
          width: '200px',
          height: '200px',
          zIndex: 1000
        }}
      />
      <input
        type="text"
        placeholder="Type a message..."
        value={chatInput}
        onChange={(e) => setChatInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && chatInput.trim() && connRef.current) {
            const message: GameMessage = { type: 'chat', text: chatInput, senderId: playerId };
            connRef.current.sendGameData(message);
            connRef.current.onMessage(message); // show local bubble
            setChatInput('');
          }
        }}
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          padding: '30px',
          fontSize: '16px',
          boxSizing: 'border-box',
          zIndex: 1001
        }}
      />
    </div>
  );
}
