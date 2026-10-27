"use client";

import React, { useState } from "react";
import { Mic, MicOff, Globe, AlertCircle } from "lucide-react";
import { useVoiceInput, VoiceLanguage } from "@/hooks/useVoiceInput";

interface VoiceInputButtonProps {
  onTranscript: (text: string) => void;
  className?: string;
  placeholderTarget?: string;
}

export function VoiceInputButton({
  onTranscript,
  className = "",
  placeholderTarget = "text input",
}: VoiceInputButtonProps) {
  const [selectedLang, setSelectedLang] = useState<VoiceLanguage>("en-IN");
  const [showLanguageMenu, setShowLanguageMenu] = useState(false);

  const {
    isSupported,
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  } = useVoiceInput({
    language: selectedLang,
    onTranscript: (newText) => {
      onTranscript(newText);
    },
  });

  const handleToggle = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  // Graceful fallback when Web Speech API is unsupported in this browser
  if (!isSupported) {
    return (
      <div className={`inline-flex items-center gap-1.5 text-xs text-muted ${className}`}>
        <span
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-bg border border-line text-[11px]"
          title="Web Speech API not supported in this browser. Please type directly."
        >
          <MicOff className="w-3 h-3 text-muted" />
          <span>Typing mode</span>
        </span>
      </div>
    );
  }

  return (
    <div className={`relative inline-flex items-center gap-1.5 ${className}`}>
      {/* Mic Trigger Button */}
      <button
        type="button"
        onClick={handleToggle}
        className={`inline-flex items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium ${
          isListening
            ? "bg-emergency text-surface border-emergency animate-pulse ring-2 ring-emergency/30"
            : "bg-surface hover:bg-bg border-line text-ink"
        }`}
        title={isListening ? "Stop voice recording" : `Speak into ${placeholderTarget}`}
        aria-label={isListening ? "Stop voice recording" : "Start voice recording"}
      >
        {isListening ? (
          <Mic className="w-4 h-4 text-surface animate-bounce" />
        ) : (
          <Mic className="w-4 h-4 text-ink" />
        )}
      </button>

      {/* Language Selector Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setShowLanguageMenu(!showLanguageMenu)}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-md border border-line bg-surface hover:bg-bg text-[11px] font-semibold text-ink"
          title="Change voice input language"
          aria-expanded={showLanguageMenu}
        >
          <Globe className="w-3 h-3 text-primary" />
          <span>{selectedLang === "en-IN" ? "EN" : selectedLang === "hi-IN" ? "HI" : "MR"}</span>
        </button>

        {showLanguageMenu && (
          <div className="absolute bottom-full mb-1 left-0 z-20 w-36 py-1 bg-surface border border-line rounded-lg shadow-md text-xs">
            <button
              type="button"
              onClick={() => {
                setSelectedLang("en-IN");
                setShowLanguageMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-bg ${
                selectedLang === "en-IN" ? "font-semibold text-primary" : "text-ink"
              }`}
            >
              English (India)
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedLang("hi-IN");
                setShowLanguageMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-bg ${
                selectedLang === "hi-IN" ? "font-semibold text-primary" : "text-ink"
              }`}
            >
              हिंदी (Hindi)
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedLang("mr-IN");
                setShowLanguageMenu(false);
              }}
              className={`w-full text-left px-3 py-1.5 hover:bg-bg ${
                selectedLang === "mr-IN" ? "font-semibold text-primary" : "text-ink"
              }`}
            >
              मराठी (Marathi)
            </button>
          </div>
        )}
      </div>

      {/* Listening Indicator with Accuracy Disclaimer */}
      {isListening && (
        <span className="text-[11px] text-emergency font-semibold animate-pulse flex items-center gap-1">
          <span>Listening...</span>
          {selectedLang !== "en-IN" && (
            <span
              className="text-[10px] text-muted font-normal cursor-help"
              title="Browser speech accuracy for Hindi and Marathi may vary. English recommended for clinical terms."
            >
              (Hindi/Marathi accuracy limited)
            </span>
          )}
        </span>
      )}

      {/* Error / Notice Display */}
      {error && !isListening && (
        <span className="text-[11px] text-emergency flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          <span>{error}</span>
        </span>
      )}
    </div>
  );
}
