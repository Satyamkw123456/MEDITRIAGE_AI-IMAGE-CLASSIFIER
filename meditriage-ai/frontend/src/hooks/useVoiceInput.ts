"use client";

import { useState, useEffect, useRef, useCallback } from "react";

// SpeechRecognition type declarations for browser environment
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export type VoiceLanguage = "en-IN" | "en-US" | "hi-IN" | "mr-IN";

interface UseVoiceInputOptions {
  language?: VoiceLanguage;
  onTranscript?: (text: string) => void;
  continuous?: boolean;
}

export function useVoiceInput({
  language = "en-IN",
  onTranscript,
  continuous = false,
}: UseVoiceInputOptions = {}) {
  const [isSupported, setIsSupported] = useState<boolean>(false);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const win = window as unknown as IWindow;
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (SpeechRec) {
      setIsSupported(true);
      try {
        const recognition = new SpeechRec();
        recognition.continuous = continuous;
        recognition.interimResults = true;
        recognition.lang = language;

        recognition.onstart = () => {
          setIsListening(true);
          setError(null);
        };

        recognition.onresult = (event: any) => {
          let currentInterim = "";
          let finalTranscript = "";

          for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
              finalTranscript += event.results[i][0].transcript;
            } else {
              currentInterim += event.results[i][0].transcript;
            }
          }

          if (finalTranscript) {
            setTranscript((prev) => {
              const updated = prev ? `${prev} ${finalTranscript}` : finalTranscript;
              if (onTranscript) onTranscript(updated);
              return updated;
            });
          }
          setInterimTranscript(currentInterim);
        };

        recognition.onerror = (event: any) => {
          setIsListening(false);
          if (event.error !== "no-speech") {
            setError(`Speech recognition notice: ${event.error}`);
          }
        };

        recognition.onend = () => {
          setIsListening(false);
          setInterimTranscript("");
        };

        recognitionRef.current = recognition;
      } catch (err: unknown) {
        setIsSupported(false);
        setError("Speech recognition failed to initialize.");
      }
    } else {
      setIsSupported(false);
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore cleanup abort errors
        }
      }
    };
  }, [language, continuous, onTranscript]);

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current || !isSupported) {
      setError("Speech recognition is not supported in this browser. Please type directly.");
      return;
    }
    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
    } catch {
      // If already started, ignore
    }
  }, [isSupported, language]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    setIsListening(false);
  }, []);

  const resetTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
    setError(null);
  }, []);

  return {
    isSupported,
    isListening,
    transcript,
    interimTranscript,
    error,
    startListening,
    stopListening,
    resetTranscript,
  };
}
