import Phaser from 'phaser';
import { useEffect, useRef, useState } from 'react';
import { WebRTCConnection } from './WebRTC';

type Pos = { x:number, y:number };
type GameMessage =
  | { type: 'pos'; pos: Pos }
  | { type: 'chat'; text: string, senderId: 'greg' | 'shannon' };

export default function Game({ roomId, playerId }: { roomId:string, playerId:'greg'|'shannon' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<WebRTCConnection|null>(null);
  const myPosRef = useRef<Pos>({ x:400, y:300 });
  const otherPosRef = useRef<Pos>({ x:600, y:300 });

  const [chatInput, setChatInput] = useState('');

  useEffect(()=>{
    // Setup WebRTC
    const conn = new WebRTCConnection(roomId, playerId);
    conn.onMessage = (data: GameMessage) => {
      if (data.type === 'pos') otherPosRef.current = data.pos;
      else if (data.type === 'chat') showBubble(data.senderId, data.text);
    };
    conn.connect();
    connRef.current = conn;

    // Phaser Game
    let game: Phaser.Game | null = null;

    let mySprite: Phaser.GameObjects.Container, otherSprite: Phaser.GameObjects.Container;
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    let myBubble: Phaser.GameObjects.Text | null = null;
    let otherBubble: Phaser.GameObjects.Text | null = null;

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
      const makeDragon = (color:number) => {
        const c = this.add.container(0,0);
        const body = this.add.ellipse(0,0,60,40,color);
        const head = this.add.ellipse(34,-10,30,22,color);
        const eye = this.add.circle(42,-12,3,0x000000);
        c.add([body, head, eye]);
        return c;
      };

      // Colors based on playerId
      const myColor = playerId==='greg'?0x8fd3ff:0xffbabf;
      const otherColor = playerId==='greg'?0xffbabf:0x8fd3ff;

      mySprite = makeDragon(myColor);
      otherSprite = makeDragon(otherColor);

      mySprite.setPosition(myPosRef.current.x, myPosRef.current.y);
      otherSprite.setPosition(otherPosRef.current.x, otherPosRef.current.y);

      cursors = this.input.keyboard!.createCursorKeys();
    }

    function showBubble(senderId: 'greg' | 'shannon', text: string) {
      const isMine = senderId === playerId;
      const x = isMine ? myPosRef.current.x : otherPosRef.current.x;
      const y = isMine ? myPosRef.current.y - 50 : otherPosRef.current.y - 50;

      const bubble = game!.scene.scenes[0].add.text(x, y, text, {
        font: '16px Arial',
        color: '#000000',
        backgroundColor: '#ffffff',
        padding: { left: 5, right: 5, top: 2, bottom: 2 },
        align: 'center'
      }).setOrigin(0.5, 1);

      bubble.setInteractive();
      bubble.on('pointerdown', () => bubble.destroy());

      if (isMine) {
        myBubble?.destroy();
        myBubble = bubble;
      } else {
        otherBubble?.destroy();
        otherBubble = bubble;
      }
    }

    function update(this: Phaser.Scene, _t:number, dt:number) {
      let moved = false;
      const speed = 200;
      if (cursors.left?.isDown) { myPosRef.current.x -= speed*dt/1000; moved=true; }
      if (cursors.right?.isDown) { myPosRef.current.x += speed*dt/1000; moved=true; }
      if (cursors.up?.isDown) { myPosRef.current.y -= speed*dt/1000; moved=true; }
      if (cursors.down?.isDown) { myPosRef.current.y += speed*dt/1000; moved=true; }

      mySprite.setPosition(myPosRef.current.x, myPosRef.current.y);
      otherSprite.setPosition(otherPosRef.current.x, otherPosRef.current.y);

      if (moved && connRef.current) {
        connRef.current.sendGameData({ type:'pos', pos: myPosRef.current });
      }
    }

    game = new Phaser.Game(config);

    return () => { game?.destroy(true); conn.ws.close(); };
  }, [roomId, playerId]);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
        <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
        <input
        type="text"
        placeholder="Type a message..."
        value={chatInput}
        onChange={e => setChatInput(e.target.value)}
        onKeyDown={e => {
            if (e.key === 'Enter' && chatInput.trim() && connRef.current) {
            connRef.current.sendGameData({ type:'chat', text: chatInput, senderId: playerId });
            setChatInput('');
            }
        }}
        style={{
            position: 'absolute',
            bottom: 10,
            left: 10,
            width: 200,
            padding: '5px',
            fontSize: '14px',
            zIndex: 1000,   // make sure it's above Phaser canvas
        }}
        />
    </div>
    );

}
