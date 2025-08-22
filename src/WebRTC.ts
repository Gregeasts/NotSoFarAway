type Pos = { x: number; y: number };
type GameMessage =
  | { type: 'pos'; pos: Pos; senderId: 'greg' | 'shannon' }
  | { type: 'chat'; text: string; senderId: 'greg' | 'shannon' }
  | { type: 'join'; senderId: 'greg' | 'shannon'; pos: Pos; lastMessage?: string };

type SignalMessage =
  | { type: 'offer'; payload: RTCSessionDescriptionInit }
  | { type: 'answer'; payload: RTCSessionDescriptionInit }
  | { type: 'ice'; payload: RTCIceCandidateInit };

export class WebRTCConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  onMessage: (data: GameMessage) => void = () => {};
  roomId: string;
  playerId: 'greg' | 'shannon';
  ws: WebSocket;
  private messageQueue: SignalMessage[] = [];
  private wsOpen = false;

  constructor(roomId: string, playerId: 'greg' | 'shannon') {
    this.roomId = roomId;
    this.playerId = playerId;

    // Create RTCPeerConnection
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    // Create data channel for game data
    this.dc = this.pc.createDataChannel('game');
    this.dc.onmessage = e => this.onMessage(JSON.parse(e.data));
    this.dc.onopen = () => console.log('Data channel open');

    // Listen for remote data channels
    this.pc.ondatachannel = e => {
      this.dc = e.channel;
      this.dc.onmessage = e => this.onMessage(JSON.parse(e.data));
    };

    // Handle ICE candidates
    this.pc.onicecandidate = e => {
      if (e.candidate) {
        this.sendSignal({ type: 'ice', payload: e.candidate.toJSON() });
      }
    };

    // Setup WebSocket signaling
    this.ws = new WebSocket(import.meta.env.VITE_SIGNALING_SERVER);

    this.ws.onopen = () => {
      this.wsOpen = true;
      console.log('Connected to signaling server');

      // Flush queued signals
      this.messageQueue.forEach(msg =>
        this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId, playerId: this.playerId }))
      );
      this.messageQueue = [];
      this.ws.send(JSON.stringify({
        type: "join",
        roomId: this.roomId,
        playerId: this.playerId,
        pos: { x: 400, y: 300 }, // default spawn (or pass in)
        lastMessage: ""
      }));
    };
    this.ws.onmessage = async e => {
        const { type, payload, playerId } = JSON.parse(e.data);
        try {
            if (type === 'offer') {
            await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
            const answer = await this.pc.createAnswer();
            await this.pc.setLocalDescription(answer);
            this.sendSignal({ type: 'answer', payload: answer });
            } else if (type === 'answer') {
            await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
            } else if (type === 'ice') {
            await this.pc.addIceCandidate(payload);
            } else if (type === 'roomState') {
            // 📝 give state to game
            this.onMessage({ type: 'join', senderId: this.playerId, pos: payload[this.playerId].pos, lastMessage: payload[this.playerId].lastMessage });
            // also give other player’s state
            const otherId = this.playerId === 'greg' ? 'shannon' : 'greg';
            if (payload[otherId]?.pos) {
                this.onMessage({ type: 'join', senderId: otherId, pos: payload[otherId].pos, lastMessage: payload[otherId].lastMessage });
            }
            } else if (type === 'pos' || type === 'chat') {
            // forward to game loop
            this.onMessage({ type, senderId: playerId, ...payload });
            }
        } catch (err) {
            console.warn('WebRTC error:', err);
        }
        };



  }

  // Start connection by creating an offer
  async connect() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type: 'offer', payload: offer });
  }

  // Send signaling messages, queue if WS not open
  sendSignal(msg: SignalMessage) {
    if (this.wsOpen && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId, playerId: this.playerId }));
    } else {
      this.messageQueue.push(msg);
    }
  }

  // Send game messages over data channel (pos or chat)
    sendGameData(data: GameMessage) {
    if (this.dc.readyState === 'open') {
        this.dc.send(JSON.stringify(data));
    }

    // Forward to server so it can persist
    if (this.wsOpen && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ ...data, roomId: this.roomId, playerId: this.playerId }));
    }
    }
}
