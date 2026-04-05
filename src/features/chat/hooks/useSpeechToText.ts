'use client';

import { useState, useCallback, useRef } from 'react';
import '../types'; // Speech API type augmentation

export type VoiceState = 'idle' | 'requesting' | 'listening' | 'processing' | 'error';

export function useSpeechToText() {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    analyserRef.current = null;
  }, []);

  const startListening = useCallback(async () => {
    // ---- Check Speech API support ----
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setVoiceState('error');
      setErrorMessage('Speech recognition is not supported in this browser. Use Chrome or Edge.');
      return;
    }

    setVoiceState('requesting');
    setTranscript('');
    setInterimTranscript('');
    setErrorMessage('');

    // ---- Check mic permission state first (macOS optimization) ----
    try {
      const permResult = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permResult.state === 'denied') {
        setVoiceState('error');
        setErrorMessage(
          'Microphone access is blocked. On macOS: System Settings > Privacy & Security > Microphone > enable for your browser. Then reload.',
        );
        return;
      }
    } catch {
      // permissions.query may not support 'microphone' in all browsers — continue anyway
    }

    // ---- Request mic access ----
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Set up audio analyser for waveform
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      // macOS: AudioContext may start in 'suspended' state
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }

      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      analyserRef.current = analyser;
    } catch (err: unknown) {
      const msg = (err as Error).message || '';
      cleanup();

      if (msg.includes('Permission denied') || msg.includes('NotAllowedError')) {
        setVoiceState('error');
        setErrorMessage(
          'Microphone permission denied. Click the lock/camera icon in your browser address bar to allow mic access, or check macOS System Settings > Privacy & Security > Microphone.',
        );
      } else if (msg.includes('NotFoundError') || msg.includes('Requested device not found')) {
        setVoiceState('error');
        setErrorMessage('No microphone found. Please connect a microphone and try again.');
      } else {
        setVoiceState('error');
        setErrorMessage(`Microphone error: ${msg}`);
      }
      return;
    }

    // ---- Start Speech Recognition ----
    const recognition = new SR();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // macOS Chrome: set maxAlternatives for better accuracy
    try {
      (recognition as any).maxAlternatives = 1;
    } catch { /* not all implementations support this */ }

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';
      let final = '';
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) {
        setTranscript(final);
        setInterimTranscript('');
        setVoiceState('processing');
      } else {
        setInterimTranscript(interim);
      }
    };

    recognition.onerror = (event: Event) => {
      const err = event as SpeechRecognitionErrorEvent;
      cleanup();

      switch (err.error) {
        case 'not-allowed':
          setVoiceState('error');
          setErrorMessage(
            'Speech recognition permission denied. Allow microphone access in your browser and macOS System Settings.',
          );
          break;
        case 'no-speech':
          // No speech detected — silently go back to idle
          setVoiceState('idle');
          break;
        case 'audio-capture':
          setVoiceState('error');
          setErrorMessage('No microphone detected. Check your audio input in macOS System Settings > Sound > Input.');
          break;
        case 'network':
          setVoiceState('error');
          setErrorMessage('Network error during speech recognition. Check your internet connection.');
          break;
        default:
          setVoiceState('error');
          setErrorMessage(`Speech recognition error: ${err.error}`);
      }
    };

    recognition.onend = () => {
      cleanup();
      setVoiceState((prev) => (prev === 'processing' ? 'processing' : 'idle'));
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setVoiceState('listening');
    } catch (err: unknown) {
      cleanup();
      setVoiceState('error');
      setErrorMessage(`Failed to start speech recognition: ${(err as Error).message}`);
    }
  }, [cleanup]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    cleanup();
    setVoiceState('idle');
  }, [cleanup]);

  const resetTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setVoiceState('idle');
  }, []);

  const getAnalyserData = useCallback((): Uint8Array | null => {
    if (!analyserRef.current) return null;
    const data = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteFrequencyData(data);
    return data;
  }, []);

  return {
    voiceState,
    transcript,
    interimTranscript,
    errorMessage,
    startListening,
    stopListening,
    resetTranscript,
    getAnalyserData,
  };
}
