import { useRef, useCallback, useState } from 'react';

export interface RecordingMeta {
  fileName: string;
  duration: number;
  size: number;
}

export function useSessionRecording() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = useCallback(async (): Promise<boolean> => {
    try {
      // Capture the entire screen + system audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: true,
      });

      // Also capture microphone audio
      let micStream: MediaStream | null = null;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch {
        console.warn('[Recording] Could not capture mic audio, recording without it');
      }

      // Combine all tracks
      const tracks = [...displayStream.getTracks()];
      if (micStream) {
        // Mix mic audio with display audio using AudioContext
        const audioContext = new AudioContext();
        const dest = audioContext.createMediaStreamDestination();

        const displayAudioTracks = displayStream.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const displaySource = audioContext.createMediaStreamSource(
            new MediaStream(displayAudioTracks)
          );
          displaySource.connect(dest);
        }

        const micSource = audioContext.createMediaStreamSource(micStream);
        micSource.connect(dest);

        // Use combined audio + display video
        const combinedStream = new MediaStream([
          ...displayStream.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
        streamRef.current = combinedStream;
      } else {
        streamRef.current = displayStream;
      }

      // Choose best supported format
      const mimeType = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4',
      ].find((mt) => MediaRecorder.isTypeSupported(mt)) || 'video/webm';

      chunksRef.current = [];
      const recorder = new MediaRecorder(streamRef.current!, {
        mimeType,
        videoBitsPerSecond: 3000000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      // If user stops screen share via browser UI, stop recording
      displayStream.getVideoTracks().forEach((track) => {
        track.onended = () => {
          if (mediaRecorderRef.current?.state === 'recording') {
            stopRecording();
          }
        };
      });

      recorder.start(1000); // collect data every second
      startTimeRef.current = Date.now();
      setIsRecording(true);

      console.log('[Recording] Started with mimeType:', mimeType);
      return true;
    } catch (err) {
      console.error('[Recording] Failed to start:', err);
      return false;
    }
  }, []);

  const stopRecording = useCallback((): Promise<RecordingMeta | null> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state === 'inactive') {
        setIsRecording(false);
        resolve(null);
        return;
      }

      recorder.onstop = () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const fileName = `session-recording-${new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-')}.webm`;

        // Trigger download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const meta: RecordingMeta = {
          fileName,
          duration,
          size: blob.size,
        };

        setIsRecording(false);
        mediaRecorderRef.current = null;
        chunksRef.current = [];

        console.log('[Recording] Stopped. Duration:', duration, 's, Size:', (blob.size / 1024 / 1024).toFixed(2), 'MB');
        resolve(meta);
      };

      recorder.stop();
    });
  }, []);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
}
