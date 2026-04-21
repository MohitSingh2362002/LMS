import { useRef, useCallback, useState } from 'react';

export interface RecordingMeta {
  fileName: string;
  duration: number;
  size: number;
}

export type RecordingStatus = 'inactive' | 'recording' | 'paused';

function speakRecordingNoticeLive() {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const u = new SpeechSynthesisUtterance('This meeting is recorded');
  u.rate = 0.95;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

async function buildMixedStream(
  displayStream: MediaStream,
  micStream: MediaStream | null,
  playAnnouncement: boolean,
): Promise<{ stream: MediaStream; audioContext: AudioContext | null }> {
  const videoTracks = displayStream.getVideoTracks();
  const displayAudioTracks = displayStream.getAudioTracks();
  const needsAudioMix =
    micStream !== null || displayAudioTracks.length > 0 || playAnnouncement;

  if (!needsAudioMix) {
    return { stream: displayStream, audioContext: null };
  }

  const audioContext = new AudioContext();
  await audioContext.resume();
  const dest = audioContext.createMediaStreamDestination();

  if (displayAudioTracks.length > 0) {
    audioContext.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(dest);
  }
  if (micStream) {
    audioContext.createMediaStreamSource(micStream).connect(dest);
  }
  if (playAnnouncement) {
    speakRecordingNoticeLive();
    try {
      const noticeUrl = `${import.meta.env.BASE_URL.replace(/\/?$/, '/')}recording-notice.mp3`;
      const res = await fetch(noticeUrl);
      if (res.ok) {
        const raw = await res.arrayBuffer();
        const buf = await audioContext.decodeAudioData(raw.slice(0));
        const src = audioContext.createBufferSource();
        src.buffer = buf;
        src.connect(dest);
        src.start(0);
      }
    } catch {
      console.warn('[Recording] Could not load recording-notice.mp3 for mix');
    }
  }

  return {
    stream: new MediaStream([...videoTracks, ...dest.stream.getAudioTracks()]),
    audioContext,
  };
}

export function useSessionRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const [recordingStatus, setRecordingStatus] = useState<RecordingStatus>('inactive');
  const streamRef = useRef<MediaStream | null>(null);
  const displayStreamRef = useRef<MediaStream | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const stopRecordingInternalRef = useRef<(() => Promise<RecordingMeta | null>) | null>(null);

  const isRecordingSession = recordingStatus !== 'inactive';

  const stopRecording = useCallback((): Promise<RecordingMeta | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setRecordingStatus('inactive');
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const fileName = `session-recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        streamRef.current?.getTracks().forEach((t) => t.stop());
        displayStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        displayStreamRef.current = null;
        micStreamRef.current = null;

        void audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;

        const meta: RecordingMeta = {
          fileName,
          duration,
          size: blob.size,
        };

        setRecordingStatus('inactive');
        mediaRecorderRef.current = null;
        chunksRef.current = [];

        console.log('[Recording] Stopped. Duration:', duration, 's, Size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
        resolve(meta);
      };

      recorder.stop();
    });
  }, []);

  stopRecordingInternalRef.current = stopRecording;

  const startRecording = useCallback(
    async (options?: { playAnnouncement?: boolean }): Promise<boolean> => {
      const playAnnouncement = options?.playAnnouncement ?? false;
      try {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
        displayStreamRef.current = displayStream;

        let micStream: MediaStream | null = null;
        try {
          micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          micStreamRef.current = micStream;
        } catch {
          console.warn('[Recording] Could not capture mic audio');
          micStreamRef.current = null;
        }

        let combinedStream: MediaStream;
        let audioContext: AudioContext | null;
        try {
          const built = await buildMixedStream(displayStream, micStream, playAnnouncement);
          combinedStream = built.stream;
          audioContext = built.audioContext;
        } catch (mixErr) {
          console.error('[Recording] Audio mix failed:', mixErr);
          displayStream.getTracks().forEach((t) => t.stop());
          micStream?.getTracks().forEach((t) => t.stop());
          displayStreamRef.current = null;
          micStreamRef.current = null;
          return false;
        }
        audioContextRef.current = audioContext;
        streamRef.current = combinedStream;

        const mimeType = [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
          'video/mp4',
        ].find((mt) => MediaRecorder.isTypeSupported(mt)) || 'video/webm';

        chunksRef.current = [];
        const recorder = new MediaRecorder(combinedStream, {
          mimeType,
          videoBitsPerSecond: 3000000,
        });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            chunksRef.current.push(e.data);
          }
        };

        displayStream.getVideoTracks().forEach((track) => {
          track.onended = () => {
            if (
              mediaRecorderRef.current?.state === 'recording' ||
              mediaRecorderRef.current?.state === 'paused'
            ) {
              void stopRecordingInternalRef.current?.();
            }
          };
        });

        recorder.start(1000);
        startTimeRef.current = Date.now();
        setRecordingStatus('recording');

        console.log('[Recording] Started with mimeType:', mimeType);
        return true;
      } catch (err) {
        console.error('[Recording] Failed to start:', err);
        displayStreamRef.current?.getTracks().forEach((t) => t.stop());
        micStreamRef.current?.getTracks().forEach((t) => t.stop());
        displayStreamRef.current = null;
        micStreamRef.current = null;
        void audioContextRef.current?.close().catch(() => {});
        audioContextRef.current = null;
        return false;
      }
    },
    [],
  );

  const pauseRecording = useCallback((): boolean => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'recording') return false;
    try {
      recorder.pause();
      setRecordingStatus('paused');
      return true;
    } catch (e) {
      console.warn('[Recording] Pause failed:', e);
      return false;
    }
  }, []);

  const resumeRecording = useCallback((): boolean => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state !== 'paused') return false;
    try {
      recorder.resume();
      setRecordingStatus('recording');
      return true;
    } catch (e) {
      console.warn('[Recording] Resume failed:', e);
      return false;
    }
  }, []);

  return {
    recordingStatus,
    isRecording: isRecordingSession,
    isPaused: recordingStatus === 'paused',
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  };
}
