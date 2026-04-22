/**
 * Hook do nagrywania głosu i generowania raportów.
 * - Mobile: expo-av (Audio.Recording)
 * - Web: MediaRecorder API
 * - Backend: Whisper STT → Claude formatting/translation
 */
import { useState, useCallback, useRef } from "react";
import { Platform } from "react-native";
import { supabase } from "@/src/lib/supabase/client";
import { useTranslation } from "react-i18next";

export type VoiceReportResult = {
  transcription: string;
  detected_language: string;
  duration: number;
  report_de: string;
  report_original: string;
  extracted_data: {
    tasks: { description: string; quantity: string; unit: string; location: string }[];
    materials: { name: string; quantity: string }[];
    issues: string[];
    work_hours: string | null;
  } | null;
  worker: string;
  generatedAt: string;
};

type RecordingState = "idle" | "recording" | "processing";

const VOICE_REPORT_URL =
  Platform.OS === "web"
    ? "/.netlify/functions/ai-voice-report"
    : `${process.env.EXPO_PUBLIC_APP_URL || "https://bsapp-management.netlify.app"}/.netlify/functions/ai-voice-report`;

// ─── Web recording helpers ───

let webMediaRecorder: MediaRecorder | null = null;
let webChunks: Blob[] = [];

async function startWebRecording(): Promise<void> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  webChunks = [];
  webMediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
  webMediaRecorder.ondataavailable = (e) => {
    if (e.data.size > 0) webChunks.push(e.data);
  };
  webMediaRecorder.start(100); // collect chunks every 100ms
}

async function stopWebRecording(): Promise<{ base64: string; mimeType: string }> {
  return new Promise((resolve, reject) => {
    if (!webMediaRecorder) return reject(new Error("No recording"));
    webMediaRecorder.onstop = async () => {
      try {
        const blob = new Blob(webChunks, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = () => {
          const dataUrl = reader.result as string;
          const base64 = dataUrl.split(",")[1] || "";
          // Stop all tracks
          webMediaRecorder?.stream.getTracks().forEach((t) => t.stop());
          webMediaRecorder = null;
          webChunks = [];
          resolve({ base64, mimeType: "audio/webm" });
        };
        reader.onerror = () => reject(new Error("Failed to read audio"));
        reader.readAsDataURL(blob);
      } catch (e) {
        reject(e);
      }
    };
    webMediaRecorder.stop();
  });
}

// ─── Mobile recording helpers (expo-av) ───

// expo-av's Recording — import type only, ponieważ modul jest wymagany dynamicznie.
type Recording = { stopAndUnloadAsync(): Promise<void>; getURI(): string | null };
let mobileRecording: Recording | null = null;

async function startMobileRecording(): Promise<void> {
  const { Audio } = require("expo-av");
  const { status } = await Audio.requestPermissionsAsync();
  if (status !== "granted") throw new Error("Microphone permission denied");

  await Audio.setAudioModeAsync({
    allowsRecordingIOS: true,
    playsInSilentModeIOS: true,
  });

  const recording = new Audio.Recording();
  await recording.prepareToRecordAsync({
    android: {
      extension: ".m4a",
      outputFormat: 2, // MPEG_4
      audioEncoder: 3, // AAC
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: ".m4a",
      outputFormat: "aac",
      audioQuality: 127,
      sampleRate: 44100,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    web: {
      mimeType: "audio/webm",
      bitsPerSecond: 128000,
    },
  });
  await recording.startAsync();
  mobileRecording = recording;
}

async function stopMobileRecording(): Promise<{ base64: string; mimeType: string }> {
  if (!mobileRecording) throw new Error("No recording");

  await mobileRecording.stopAndUnloadAsync();
  const uri = mobileRecording.getURI();
  mobileRecording = null;

  if (!uri) throw new Error("No recording URI");

  const FileSystem = require("expo-file-system");
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  const mimeType = Platform.OS === "ios" ? "audio/m4a" : "audio/mp4";
  return { base64, mimeType };
}

// ─── Main Hook ───

export function useVoiceReport(projectId?: string, projectName?: string) {
  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VoiceReportResult | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const { i18n } = useTranslation();

  const startRecording = useCallback(async () => {
    setError(null);
    setResult(null);
    setRecordingDuration(0);

    try {
      if (Platform.OS === "web") {
        await startWebRecording();
      } else {
        await startMobileRecording();
      }
      setState("recording");

      // Duration timer
      timerRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || "Failed to start recording");
      setState("idle");
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    if (state !== "recording") return;

    // Stop timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    setState("processing");
    setError(null);

    try {
      // Stop recording and get audio data
      let audioData: { base64: string; mimeType: string };
      if (Platform.OS === "web") {
        audioData = await stopWebRecording();
      } else {
        audioData = await stopMobileRecording();
      }

      // Get auth token
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || "";

      // Send to backend
      const response = await fetch(VOICE_REPORT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          audioBase64: audioData.base64,
          mimeType: audioData.mimeType,
          projectId: projectId || null,
          projectName: projectName || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP ${response.status}`);
      }

      if (!data.transcription) {
        setError("No speech detected");
        setState("idle");
        return;
      }

      setResult(data as VoiceReportResult);
      setState("idle");
    } catch (e: unknown) {
      setError((e instanceof Error ? e.message : null) || "Processing failed");
      setState("idle");
    }
  }, [state, projectId, projectName]);

  const cancelRecording = useCallback(async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      if (Platform.OS === "web" && webMediaRecorder) {
        webMediaRecorder.stream.getTracks().forEach((t) => t.stop());
        webMediaRecorder = null;
        webChunks = [];
      } else if (mobileRecording) {
        await mobileRecording.stopAndUnloadAsync();
        mobileRecording = null;
      }
    } catch {
      // ignore cleanup errors
    }

    setState("idle");
    setRecordingDuration(0);
  }, []);

  const clearResult = useCallback(() => {
    setResult(null);
    setError(null);
    setRecordingDuration(0);
  }, []);

  return {
    state,
    error,
    result,
    recordingDuration,
    startRecording,
    stopAndProcess,
    cancelRecording,
    clearResult,
  };
}
