import type { AvatarSpeechRequestContext } from './avatarVoiceClient';

export type AvatarRealtimeStatus =
  | 'requesting_microphone'
  | 'connecting'
  | 'connected'
  | 'closed';

export type AvatarRealtimeConnection = {
  stop: () => void;
};

type AvatarRealtimeHandlers = {
  onStatus?: (status: AvatarRealtimeStatus) => void;
  onEvent?: (event: unknown) => void;
};

function assertRealtimeSession(context: AvatarSpeechRequestContext) {
  if (!context.sessionId) throw new Error('avatar_realtime_session_required');
  return context.sessionId;
}

function createRemoteAudioSink() {
  if (typeof document === 'undefined' || typeof MediaStream === 'undefined') return null;
  const stream = new MediaStream();
  const audio = document.createElement('audio');
  audio.autoplay = true;
  audio.setAttribute('playsinline', 'true');
  audio.setAttribute('aria-hidden', 'true');
  audio.style.display = 'none';
  audio.srcObject = stream;
  document.body.appendChild(audio);
  return {
    stream,
    audio,
    dispose() {
      audio.remove();
    }
  };
}

function waitForIceGatheringComplete(peerConnection: RTCPeerConnection, timeoutMs = 2500) {
  if (peerConnection.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      peerConnection.removeEventListener('icegatheringstatechange', handleStateChange);
      resolve();
    };
    const handleStateChange = () => {
      if (peerConnection.iceGatheringState === 'complete') finish();
    };
    const timeout = window.setTimeout(finish, timeoutMs);
    peerConnection.addEventListener('icegatheringstatechange', handleStateChange);
  });
}

async function readRealtimeAnswer(response: Response) {
  const contentType = response.headers.get('content-type')?.toLowerCase() ?? '';
  if (response.ok && contentType.includes('application/sdp')) {
    return response.text();
  }

  try {
    const body = (await response.json()) as { error?: string };
    throw new Error(body.error || `avatar_realtime_http_${response.status}`);
  } catch (error) {
    if (error instanceof Error && !error.message.startsWith('Unexpected token')) throw error;
    throw new Error(`avatar_realtime_http_${response.status}`);
  }
}

export async function startAvatarRealtimeConversation(
  context: AvatarSpeechRequestContext,
  handlers: AvatarRealtimeHandlers = {}
): Promise<AvatarRealtimeConnection> {
  const sessionId = assertRealtimeSession(context);
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('avatar_realtime_microphone_unavailable');
  }
  if (typeof RTCPeerConnection === 'undefined') {
    throw new Error('avatar_realtime_webrtc_unavailable');
  }

  let localStream: MediaStream | null = null;
  let peerConnection: RTCPeerConnection | null = null;
  let remoteAudio: ReturnType<typeof createRemoteAudioSink> = null;

  const stop = () => {
    handlers.onStatus?.('closed');
    localStream?.getTracks().forEach((track) => track.stop());
    peerConnection?.close();
    remoteAudio?.dispose();
    localStream = null;
    peerConnection = null;
    remoteAudio = null;
  };

  try {
    handlers.onStatus?.('requesting_microphone');
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });

    handlers.onStatus?.('connecting');
    peerConnection = new RTCPeerConnection();
    remoteAudio = createRemoteAudioSink();

    peerConnection.ontrack = (event) => {
      if (!remoteAudio) return;
      const remoteTrack = event.track;
      if (remoteTrack) remoteAudio.stream.addTrack(remoteTrack);
      void remoteAudio.audio.play().catch(() => undefined);
    };

    localStream.getTracks().forEach((track) => {
      peerConnection?.addTrack(track, localStream as MediaStream);
    });

    const eventChannel = peerConnection.createDataChannel('oai-events');
    eventChannel.onmessage = (event) => {
      try {
        handlers.onEvent?.(JSON.parse(event.data));
      } catch {
        handlers.onEvent?.(event.data);
      }
    };

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);
    await waitForIceGatheringComplete(peerConnection);
    const offerSdp = peerConnection.localDescription?.sdp || offer.sdp;
    if (!offerSdp) throw new Error('avatar_realtime_offer_failed');

    const headers: Record<string, string> = {
      'Content-Type': 'application/sdp',
      'x-avatar-session-id': sessionId
    };
    if (context.studentToken) headers['x-student-context'] = context.studentToken;

    const response = await fetch('/api/avatar/realtime-session', {
      method: 'POST',
      headers,
      body: offerSdp
    });
    const answerSdp = await readRealtimeAnswer(response);

    await peerConnection.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answerSdp }));
    handlers.onStatus?.('connected');

    return { stop };
  } catch (error) {
    stop();
    throw error;
  }
}
