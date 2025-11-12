"use client";

import React, { useState, useEffect, useRef } from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SOSButtonProps {
  isActive: boolean;
  onToggleSOS: () => void;
}

export function SOSButton({ isActive: externalIsActive, onToggleSOS }: SOSButtonProps) {
  const [isActive, setIsActive] = useState(externalIsActive);
  const [flashlightSupported, setFlashlightSupported] = useState(false);
  const [flashlightPermission, setFlashlightPermission] = useState<"granted" | "denied" | "prompt">("prompt");

  const screenFlashRef = useRef<HTMLDivElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const oscillatorRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const morsePatternRef = useRef<Array<[number, boolean]>>([]);
  const currentStepRef = useRef<number>(0);
  const isActiveRef = useRef<boolean>(false);

  // S.O.S. Morse code pattern: ... --- ...
  // Short = 200ms, Long = 600ms, Gap = 200ms
  // Pattern: [duration, isOn] pairs
  // S = ... (3 short flashes with gaps)
  // O = --- (3 long flashes with gaps)
  // S = ... (3 short flashes with gaps)
  const SOS_PATTERN: Array<[number, boolean]> = [
    [200, true],   // S: short flash ON
    [200, false],  // gap OFF
    [200, true],   // short flash ON
    [200, false],  // gap OFF
    [200, true],   // short flash ON
    [200, false],  // letter gap OFF
    [600, true],   // O: long flash ON
    [200, false],  // gap OFF
    [600, true],   // long flash ON
    [200, false],  // gap OFF
    [600, true],   // long flash ON
    [200, false],  // letter gap OFF
    [200, true],   // S: short flash ON
    [200, false],  // gap OFF
    [200, true],   // short flash ON
    [200, false],  // gap OFF
    [200, true],   // short flash ON
    [1000, false], // long gap OFF before repeat
  ];

  // Check flashlight support on mount
  useEffect(() => {
    const checkFlashlightSupport = async () => {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
          });
          const track = stream.getVideoTracks()[0];
          const capabilities = track.getCapabilities();
          
          if ('torch' in capabilities && capabilities.torch) {
            setFlashlightSupported(true);
          }
          
          // Stop the test stream
          stream.getTracks().forEach((t) => t.stop());
        } catch (error) {
          console.log("Flashlight not supported:", error);
          setFlashlightSupported(false);
        }
      }
    };

    checkFlashlightSupport();
  }, []);

  // Request camera permission for flashlight
  const requestFlashlightPermission = async (): Promise<boolean> => {
    if (!flashlightSupported) return false;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      
      const track = stream.getVideoTracks()[0];
      const capabilities = track.getCapabilities();
      
      if ('torch' in capabilities && capabilities.torch) {
        streamRef.current = stream;
        trackRef.current = track;
        setFlashlightPermission("granted");
        return true;
      } else {
        stream.getTracks().forEach((t) => t.stop());
        setFlashlightPermission("denied");
        return false;
      }
    } catch (error) {
      console.error("Flashlight permission denied:", error);
      setFlashlightPermission("denied");
      return false;
    }
  };

  // Control flashlight
  const controlFlashlight = async (on: boolean) => {
    if (!trackRef.current) {
      const hasPermission = await requestFlashlightPermission();
      if (!hasPermission) return;
    }

    try {
      if (trackRef.current && "applyConstraints" in trackRef.current) {
        await trackRef.current.applyConstraints({
          advanced: [{ torch: on } as any],
        });
      }
    } catch (error) {
      console.error("Flashlight control error:", error);
    }
  };

  // Start sound alarm
  const startSoundAlarm = () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      
      // Alternating frequency pattern
      oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(1200, audioContext.currentTime + 0.5);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 1.0);

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.start();
      
      // Create alternating pattern
      const alternateFrequency = () => {
        const now = audioContext.currentTime;
        oscillator.frequency.cancelScheduledValues(now);
        oscillator.frequency.setValueAtTime(800, now);
        oscillator.frequency.exponentialRampToValueAtTime(1200, now + 0.5);
        oscillator.frequency.exponentialRampToValueAtTime(800, now + 1.0);
      };

      const intervalId = setInterval(alternateFrequency, 1000);

      oscillatorRef.current = oscillator;
      gainNodeRef.current = gainNode;

      // Store interval ID for cleanup
      (oscillatorRef.current as any).__intervalId = intervalId;

      oscillator.onended = () => {
        clearInterval(intervalId);
      };
    } catch (error) {
      console.error("Sound alarm error:", error);
    }
  };

  // Stop sound alarm
  const stopSoundAlarm = () => {
    if (oscillatorRef.current) {
      try {
        const intervalId = (oscillatorRef.current as any).__intervalId;
        if (intervalId) {
          clearInterval(intervalId);
        }
        oscillatorRef.current.stop();
        oscillatorRef.current.disconnect();
      } catch (error) {
        console.error("Error stopping sound:", error);
      }
      oscillatorRef.current = null;
    }
    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }
  };

  // Process one segment of the Morse code pattern
  const processPatternSegment = (segmentIndex: number) => {
    if (!isActiveRef.current || segmentIndex >= morsePatternRef.current.length) {
      // Restart pattern cycle if still active
      if (isActiveRef.current) {
        processPatternSegment(0);
      }
      return;
    }

    const [duration, isOn] = morsePatternRef.current[segmentIndex];

    if (screenFlashRef.current) {
      // Ensure overlay is visible
      screenFlashRef.current.style.display = "block";
      screenFlashRef.current.style.opacity = "1";
      
      // Flash between white (isOn=true) and black (isOn=false)
      screenFlashRef.current.style.backgroundColor = isOn ? "white" : "black";
    }

    // Control flashlight with same pattern (only ON when white)
    if (flashlightSupported && flashlightPermission === "granted") {
      controlFlashlight(isOn).catch(console.error);
    }

    // Schedule next segment
    if (isActiveRef.current) {
      timeoutRef.current = setTimeout(() => {
        processPatternSegment(segmentIndex + 1);
      }, duration);
    }
  };

  // Start SOS features
  const startSOS = () => {
    setIsActive(true);
    isActiveRef.current = true;
    morsePatternRef.current = SOS_PATTERN;
    currentStepRef.current = 0;

    // Start screen flash - ensure it's visible
    if (screenFlashRef.current) {
      screenFlashRef.current.style.display = "block";
      screenFlashRef.current.style.opacity = "1";
    }

    // Start sound alarm
    startSoundAlarm();

    // Request flashlight permission if needed
    if (flashlightSupported && flashlightPermission === "prompt") {
      requestFlashlightPermission();
    }

    // Start pattern from the beginning
    processPatternSegment(0);
  };

  // Stop SOS features
  const stopSOS = () => {
    setIsActive(false);
    isActiveRef.current = false;

    // Stop screen flash
    if (screenFlashRef.current) {
      screenFlashRef.current.style.display = "none";
      screenFlashRef.current.style.opacity = "0";
      screenFlashRef.current.style.backgroundColor = "white";
    }

    // Stop sound alarm
    stopSoundAlarm();

    // Stop flashlight
    if (trackRef.current) {
      controlFlashlight(false).catch(console.error);
    }

    // Cancel timeout
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  // Sync external state with internal state
  useEffect(() => {
    if (externalIsActive !== isActiveRef.current) {
      isActiveRef.current = externalIsActive;
      setIsActive(externalIsActive);
      
      if (externalIsActive) {
        startSOS();
      } else {
        stopSOS();
      }
    }
  }, [externalIsActive]);

  // Toggle SOS
  const toggleSOS = () => {
    onToggleSOS();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSOS();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(console.error);
      }
    };
  }, []);

  return (
    <>
      {/* Screen flash overlay */}
      <div
        ref={screenFlashRef}
        className="fixed inset-0 z-[9998] pointer-events-none"
        style={{ 
          display: "none", 
          opacity: 1, 
          backgroundColor: "white"
        }}
      />

      {/* SOS Button - Must be above flash overlay */}
      <Button
        onClick={toggleSOS}
        variant="ghost"
        size="icon"
        className={cn(
          "h-10 w-10 md:h-12 md:w-12",
          "rounded-full",
          "border-2",
          "shadow-lg",
          "pointer-events-auto",
          isActive && "animate-pulse bg-red-600 hover:bg-red-700 text-white border-red-800 shadow-red-500/50",
          !isActive && "bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:border-gray-700 border-gray-300 shadow-gray-500/30"
        )}
        aria-label={isActive ? "Deactivate SOS" : "Activate SOS"}
      >
        <AlertTriangle className="h-5 w-5 md:h-6 md:w-6" />
      </Button>
    </>
  );
}

