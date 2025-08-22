type GameMessage = 
  | { type: 'pos'; pos: { x: number; y: number } }
  | { type: 'chat'; text: string }; // optional for future messages
type SignalMessage =
  | { type: 'offer'; payload: RTCSessionDescriptionInit }
  | { type: 'answer'; payload: RTCSessionDescriptionInit }
  | { type: 'ice'; payload: RTCIceCandidateInit };
export class WebRTCConnection {
  pc: RTCPeerConnection;
  dc: RTCDataChannel;
  onMessage: (data: GameMessage) => void = () => {};
  roomId: string;
  ws: WebSocket;
  private messageQueue: SignalMessage[] = [];
  private wsOpen = false;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
    });

    this.dc = this.pc.createDataChannel('game');
    this.dc.onmessage = e => this.onMessage(JSON.parse(e.data));

    this.pc.ondatachannel = e => {
      this.dc = e.channel;
      this.dc.onmessage = e => this.onMessage(JSON.parse(e.data));
    };

    this.pc.onicecandidate = e => {
      if (e.candidate) {
        this.sendSignal({ type: 'ice', payload: e.candidate.toJSON() });
      }
    };

    this.ws = new WebSocket(import.meta.env.VITE_SIGNALING_SERVER);

    // ✅ Only mark WS open after connection is established
    this.ws.onopen = () => {
      this.wsOpen = true;
      console.log('Connected to signaling server');

      // Flush queued messages
      this.messageQueue.forEach(msg => 
        this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId }))
      );
      this.messageQueue = [];
    };

    this.ws.onmessage = async e => {
      const { type, payload } = JSON.parse(e.data);
      if (type === 'offer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
        const answer = await this.pc.createAnswer();
        await this.pc.setLocalDescription(answer);
        this.sendSignal({ type:'answer', payload:answer });
      } else if (type === 'answer') {
        await this.pc.setRemoteDescription(new RTCSessionDescription(payload));
      } else if (type === 'ice') {
        try { await this.pc.addIceCandidate(payload); } 
        catch (err) { console.warn('Failed to add ICE candidate:', err); }
      }
    };
  }

  async connect() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type:'offer', payload:offer });
  }

  // ✅ Queue signals until WS is open
  sendSignal(msg: SignalMessage) {
    if (this.wsOpen && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId }));
    } else {
      this.messageQueue.push(msg);
    }
  }

  sendGameData(data: GameMessage) {
    if (this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(data));
    }
  }
}
