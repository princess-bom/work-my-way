import { RealtimeClientSecretSchema } from '../shared/realtime-schema';

type RealtimeCoachCallbacks = {
  onState: (state: 'connecting' | 'active' | 'idle') => void;
  onMessage: (message: string) => void;
};

export class RealtimeCoach {
  private peer: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  private microphone: MediaStream | null = null;
  private audio: HTMLAudioElement | null = null;

  constructor(private readonly callbacks: RealtimeCoachCallbacks) {}

  async start(runId: string) {
    this.stop();
    this.callbacks.onState('connecting');
    this.callbacks.onMessage('마이크를 연결하고 있어요.');

    try {
      const tokenResponse = await fetch('/api/avatar/realtime-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ runId })
      });
      if (!tokenResponse.ok) throw new Error(`Realtime session returned ${tokenResponse.status}.`);
      const secret = RealtimeClientSecretSchema.parse(await tokenResponse.json());

      const peer = new RTCPeerConnection();
      const audio = document.createElement('audio');
      audio.autoplay = true;
      peer.ontrack = (event) => { audio.srcObject = event.streams[0]; };

      const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
      microphone.getTracks().forEach((track) => peer.addTrack(track, microphone));

      const channel = peer.createDataChannel('oai-events');
      this.peer = peer;
      this.channel = channel;
      this.microphone = microphone;
      this.audio = audio;
      channel.onopen = () => {
        this.callbacks.onState('active');
        this.callbacks.onMessage('이든이 듣고 있어요. 그림 버튼을 사용해도 괜찮아요.');
        channel.send(JSON.stringify({
          type: 'response.create',
          response: {
            instructions: '학생에게 짧게 인사하고, 화면에서 반납된 책 옆에 무엇이 보이는지 한 가지 질문하세요.',
            output_modalities: ['audio']
          }
        }));
      };
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type?: string; error?: { message?: string } };
          if (message.type === 'error') this.callbacks.onMessage(message.error?.message ?? '음성 대화에 문제가 생겼어요.');
        } catch {
          // Realtime event payloads are intentionally not stored or transcribed.
        }
      };
      channel.onclose = () => this.callbacks.onState('idle');

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      const answerResponse = await fetch('https://api.openai.com/v1/realtime/calls', {
        method: 'POST',
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${secret.value}`,
          'Content-Type': 'application/sdp'
        }
      });
      if (!answerResponse.ok) throw new Error(`Realtime WebRTC returned ${answerResponse.status}.`);
      await peer.setRemoteDescription({ type: 'answer', sdp: await answerResponse.text() });

    } catch (error) {
      this.stop();
      throw error;
    }
  }

  stop() {
    this.channel?.close();
    this.microphone?.getTracks().forEach((track) => track.stop());
    this.peer?.close();
    if (this.audio) this.audio.srcObject = null;
    this.peer = null;
    this.channel = null;
    this.microphone = null;
    this.audio = null;
    this.callbacks.onState('idle');
  }
}
