import Phaser from 'phaser';
import { useEffect, useRef } from 'react';
import { WebRTCConnection } from './WebRTC';

type Pos = { x:number, y:number };
type GameMessage =
  | { type: 'pos'; pos: Pos }
  | { type: 'chat'; text: string };

export default function Game({ roomId, playerId }: { roomId:string, playerId:'greg'|'shannon' }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const connRef = useRef<WebRTCConnection|null>(null);
  const myPosRef = useRef<Pos>({ x:400, y:300 });
  const otherPosRef = useRef<Pos>({ x:600, y:300 });

  useEffect(()=>{
    // Setup WebRTC
    const conn = new WebRTCConnection(roomId, playerId);
    conn.onMessage = (data: GameMessage) => {
      if (data.type === 'pos') otherPosRef.current = data.pos;
    };
    conn.connect();
    connRef.current = conn;

    // Phaser Game
    let game: Phaser.Game | null = null;
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

      // Assign colors based on playerId
      const myColor = playerId==='greg'?0x8fd3ff:0xffbabf;
      const otherColor = playerId==='greg'?0xffbabf:0x8fd3ff;

      mySprite = makeDragon(myColor);
      otherSprite = makeDragon(otherColor);

      mySprite.setPosition(myPosRef.current.x, myPosRef.current.y);
      otherSprite.setPosition(otherPosRef.current.x, otherPosRef.current.y);

      cursors = this.input.keyboard!.createCursorKeys();
    }

    let mySprite: Phaser.GameObjects.Container, otherSprite: Phaser.GameObjects.Container;
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;

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

  return <div ref={containerRef} style={{width:'100%',height:'100%'}} />;
}
