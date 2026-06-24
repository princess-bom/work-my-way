import { afterEach, describe, expect, it, vi } from 'vitest';
import { startAvatarRealtimeConversation } from './avatarRealtimeClient';

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('avatar realtime microphone client', () => {
  it('sends a browser WebRTC offer to the authenticated avatar realtime endpoint', async () => {
    const stopTrack = vi.fn();
    const audioTrack = { stop: stopTrack };
    const stream = {
      getTracks: () => [audioTrack]
    } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    const addTrack = vi.fn();
    const createDataChannel = vi.fn(() => ({ onmessage: null }));
    const setLocalDescription = vi.fn();
    const setRemoteDescription = vi.fn();
    const closePeerConnection = vi.fn();

    class FakePeerConnection {
      iceGatheringState = 'complete';
      localDescription = { type: 'offer', sdp: 'offer-sdp-with-candidates' };
      addTrack = addTrack;
      createDataChannel = createDataChannel;
      setLocalDescription = setLocalDescription;
      setRemoteDescription = setRemoteDescription;
      close = closePeerConnection;
      addEventListener = vi.fn();
      removeEventListener = vi.fn();

      async createOffer() {
        return { type: 'offer', sdp: 'offer-sdp' };
      }
    }

    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    vi.stubGlobal('RTCPeerConnection', FakePeerConnection);
    vi.stubGlobal('RTCSessionDescription', class {
      constructor(readonly init: RTCSessionDescriptionInit) {
        Object.assign(this, init);
      }
    });
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response('answer-sdp', {
        status: 200,
        headers: { 'content-type': 'application/sdp' }
      })
    ) as unknown as typeof fetch;

    const realtime = await startAvatarRealtimeConversation({
      sessionId: '11111111-1111-4111-8111-111111111111',
      studentToken: 'student-token-1',
      allowBrowserFallback: false
    });

    expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(addTrack).toHaveBeenCalledWith(audioTrack, stream);
    expect(createDataChannel).toHaveBeenCalledWith('oai-events');
    expect(setLocalDescription).toHaveBeenCalledWith({ type: 'offer', sdp: 'offer-sdp' });
    expect(globalThis.fetch).toHaveBeenCalledWith('/api/avatar/realtime-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sdp',
        'x-avatar-session-id': '11111111-1111-4111-8111-111111111111',
        'x-student-context': 'student-token-1'
      },
      body: 'offer-sdp-with-candidates'
    });
    expect(setRemoteDescription).toHaveBeenCalledWith(expect.objectContaining({ type: 'answer', sdp: 'answer-sdp' }));

    realtime.stop();

    expect(stopTrack).toHaveBeenCalledTimes(1);
    expect(closePeerConnection).toHaveBeenCalledTimes(1);
  });

  it('fails before requesting the microphone when no API student session exists', async () => {
    const getUserMedia = vi.fn();
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });

    await expect(startAvatarRealtimeConversation({ allowBrowserFallback: true })).rejects.toThrow('avatar_realtime_session_required');

    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
