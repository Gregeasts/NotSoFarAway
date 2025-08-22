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

    // ICE candidates
    this.pc.onicecandidate = e => {
    if (e.candidate) {
        this.sendSignal({
        type: 'ice',
        payload: e.candidate.toJSON() // RTCIceCandidateInit
        });
    }
    };

    // WebSocket for signaling
    this.ws = new WebSocket(import.meta.env.VITE_SIGNALING_SERVER);
    this.ws.onopen = () => {
      console.log('Connected to signaling server');
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
        try { await this.pc.addIceCandidate(payload); } catch (err) {
                console.warn('Failed to add ICE candidate:', err);
            }
      }
    };
  }

  async connect() {
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    this.sendSignal({ type:'offer', payload:offer });
  }

  sendSignal(msg: SignalMessage) {
    this.ws.send(JSON.stringify({ ...msg, roomId: this.roomId }));
  }

  sendGameData(data: GameMessage) {
    if (this.dc.readyState === 'open') {
      this.dc.send(JSON.stringify(data));
    }
  }
}
