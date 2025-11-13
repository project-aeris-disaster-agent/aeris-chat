"use client";

import React from "react"; 

import { CanvasRevealEffect } from "@/components/ui/canvas-effect";

import { AlertCircle, Phone, Plus, Send, X } from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";

import { ThemeToggle } from "@/components/ui/theme-toggle";

import { ColorSlider, AnimationSettings } from "@/components/ui/color-slider";

import { LoadingBlob } from "@/components/ui/loading-blob";

import AERISLogo from "@/assets/AERIS LOGO.svg";

import { SOSButton } from "@/components/chat/SOSButton";

import { GradientButton } from "@/components/ui/gradient-button";

import { EmergencyHotlinesModal } from "@/components/chat/EmergencyHotlinesModal";
import { DonationWalletModal } from "@/components/chat/DonationWalletModal";
import { MessageList } from "@/components/chat/MessageList";
import { useChat } from "@/hooks/useChat";
import { useSessions } from "@/hooks/useSessions";

export function Chatbot() {

  const [hovered, setHovered] = React.useState(false);

  const [isSOSActive, setIsSOSActive] = React.useState(false);

  const [isHotlinesModalOpen, setIsHotlinesModalOpen] = React.useState(false);
  const [isDonationModalOpen, setIsDonationModalOpen] = React.useState(false);

  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null);

  const [selectedColors, setSelectedColors] = React.useState<number[][]>([[135, 206, 250]]);

  const [animationSettings, setAnimationSettings] = React.useState<AnimationSettings>({
    animationSpeed: 0.5,
    opacityMin: 0.5,
    opacityMax: 1.0,
    dotSize: 6,
    hue: 0,
    saturation: 1.0,
    contrast: 1.0,
    glow: 0.0,
    vibrance: 0.0,
  });

  const [errorPopup, setErrorPopup] = React.useState<{ message: string; detail?: string } | null>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const animationRafRef = React.useRef<number | null>(null);
  const mainButtonsRef = React.useRef<HTMLDivElement>(null);
  const [messageInput, setMessageInput] = React.useState("");
  const [currentSessionId, setCurrentSessionId] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);

  // Chat hooks
  const { sessions, createSession, isLoading: sessionsLoading } = useSessions();
  const { messages, sendMessage, isLoading: messagesLoading } = useChat(currentSessionId);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Initialize session on mount
  React.useEffect(() => {
    if (!sessionsLoading && sessions.length === 0 && !currentSessionId) {
      handleNewSession();
    } else if (sessions.length > 0 && !currentSessionId) {
      setCurrentSessionId(sessions[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessions.length, sessionsLoading]);

  const handleNewSession = async () => {
    try {
      const newSession = await createSession(undefined);
      if (newSession) {
        setCurrentSessionId(newSession.id);
      }
    } catch (error) {
      console.error('Error creating session:', error);
    }
  };

  // Handle SOS call to 911
  const handleSOSCall = () => {
    // Create a temporary anchor element to initiate phone call
    const phoneLink = document.createElement('a');
    phoneLink.href = 'tel:911';
    phoneLink.click();
  };

  const handleScrollToMainButtons = React.useCallback(() => {
    if (mainButtonsRef.current) {
      mainButtonsRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const triggerBackgroundAnimation = React.useCallback(() => {
    setHovered(false);
    if (animationRafRef.current !== null) {
      cancelAnimationFrame(animationRafRef.current);
    }
    animationRafRef.current = requestAnimationFrame(() => {
      setHovered(true);
      animationRafRef.current = null;
    });
  }, []);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted, messageInput:', messageInput);
    
    if (!messageInput.trim() || isSending || messagesLoading) {
      console.log('Submission blocked:', { 
        hasMessage: !!messageInput.trim(), 
        isSending, 
        messagesLoading 
      });
      return;
    }

    const messageToSend = messageInput.trim();
    setMessageInput("");
    setIsSending(true);

    try {
      console.log('Creating/getting session...');
      let sessionId = currentSessionId;
      if (!sessionId) {
        // Create session if none exists
        console.log('No session, creating new one...');
        const newSession = await createSession(undefined);
        console.log('New session created:', newSession);
        if (newSession) {
          sessionId = newSession.id;
          setCurrentSessionId(sessionId);
        } else {
          throw new Error('Failed to create session');
        }
      }
      
      if (sessionId) {
        console.log('Sending message to session:', sessionId);
        await sendMessage(messageToSend, sessionId);
        console.log('Message sent successfully');
        triggerBackgroundAnimation();
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setMessageInput(messageToSend);
      const rawMessage =
        error instanceof Error
          ? error.message
          : typeof error === "string"
          ? error
          : 'Failed to send message';
      const normalized = rawMessage.toLowerCase();
      const backendUnavailable = [
        'llm backend',
        'backend service is currently unavailable',
        'unable to connect to backend service',
        'backend api is not configured',
        'request timeout',
        'failed to fetch',
        '503',
      ].some((fragment) => normalized.includes(fragment));

      const message = backendUnavailable
        ? 'Servers are busy, try again later #6656'
        : 'Server congestion error #6657';

      setErrorPopup({
        message,
        detail: rawMessage,
      });
    } finally {
      setIsSending(false);
    }
  };

  // Generate opacity array from min/max settings
  const generateOpacities = React.useMemo(() => {
    const steps = 10;
    const range = animationSettings.opacityMax - animationSettings.opacityMin;
    return Array.from({ length: steps }, (_, i) => {
      const t = i / (steps - 1);
      return animationSettings.opacityMin + range * t;
    });
  }, [animationSettings.opacityMin, animationSettings.opacityMax]);

  // Mouse/touch tracking

  React.useEffect(() => {

    const handleMouseMove = (e: MouseEvent) => {

      if (containerRef.current) {

        const rect = containerRef.current.getBoundingClientRect();

        setMousePosition({

          x: e.clientX - rect.left,

          y: e.clientY - rect.top,

        });

      }

    };

    const handleTouchMove = (e: TouchEvent) => {
      // Only track touch moves for animation - don't interfere with interactive elements
      const target = e.target as HTMLElement;
      if (target && (
        target.tagName === 'BUTTON' ||
        target.tagName === 'A' ||
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[role="button"]') ||
        target.closest('input') ||
        target.closest('textarea')
      )) {
        return; // Don't track touch moves on buttons/links/inputs
      }

      if (containerRef.current && e.touches.length > 0) {
        const rect = containerRef.current.getBoundingClientRect();
        setMousePosition({
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        });
      }
    };

    const handleMouseLeave = () => {

      setMousePosition(null);

    };

    const container = containerRef.current;

    if (container) {

      container.addEventListener("mousemove", handleMouseMove);

      // Only track touchmove for animation - using passive to not interfere with clicks
      container.addEventListener("touchmove", handleTouchMove, { passive: true });

      container.addEventListener("mouseleave", handleMouseLeave);

      container.addEventListener("touchend", handleMouseLeave);

    }

    return () => {

      if (container) {

        container.removeEventListener("mousemove", handleMouseMove);

        container.removeEventListener("touchmove", handleTouchMove);

        container.removeEventListener("mouseleave", handleMouseLeave);

        container.removeEventListener("touchend", handleMouseLeave);

      }

    };

  }, []);

  React.useEffect(() => {
    if (!errorPopup) return;
    const timer = window.setTimeout(() => setErrorPopup(null), 6000);
    return () => window.clearTimeout(timer);
  }, [errorPopup]);

  React.useEffect(() => {
    return () => {
      if (animationRafRef.current !== null) {
        cancelAnimationFrame(animationRafRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const mainButtonsEl = mainButtonsRef.current;
    if (!mainButtonsEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setShowScrollButton(!entry.isIntersecting);
      },
      {
        root: containerRef.current ?? undefined,
        threshold: 0.6,
      }
    );

    observer.observe(mainButtonsEl);

    return () => observer.disconnect();
  }, []);

  return (

    <div ref={containerRef} className="relative flex-1 h-full w-full flex flex-col overflow-hidden">

      <AnimatePresence>
        {errorPopup && (
          <motion.div
            key="chatbot-error-popup"
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 24 }}
            className="pointer-events-none fixed inset-x-0 top-safe z-[9998] flex justify-center px-3"
            style={{ top: `calc(env(safe-area-inset-top, 0px) + 0.5rem)` }}
          >
            <div className="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg border border-destructive/40 bg-destructive/90 px-4 py-3 text-destructive-foreground shadow-lg backdrop-blur-sm dark:bg-destructive">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold tracking-tight">
                  {errorPopup.message}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setErrorPopup(null)}
                className="rounded-md p-1 text-destructive-foreground/80 transition hover:bg-destructive-foreground/15 hover:text-destructive-foreground focus:outline-none focus:ring-2 focus:ring-destructive-foreground/40 focus:ring-offset-2 focus:ring-offset-transparent"
                aria-label="Close error message"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* SOS Button & Scroll Control - Top Left */}
      <div 
        className="fixed top-safe left-safe z-[9999] flex items-center gap-2 md:top-4 md:left-4"
        style={{ 
          top: `calc(env(safe-area-inset-top, 0px) + 0.5rem)`,
          left: `calc(env(safe-area-inset-left, 0px) + 0.5rem)`
        }}
      >
        <SOSButton isActive={isSOSActive} onToggleSOS={() => setIsSOSActive((prev) => !prev)} />
        <AnimatePresence>
          {showScrollButton && (
            <motion.div
              key="scroll-phone-button"
              initial={{ opacity: 0, scale: 0.8, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: -6 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={handleScrollToMainButtons}
                className="h-10 w-10 md:h-11 md:w-11 rounded-full border-2 border-red-500/50 bg-red-500/90 text-white shadow-lg transition hover:bg-red-500 focus-visible:ring-red-500"
                aria-label="Scroll to emergency controls"
              >
                <Phone className="h-5 w-5" />
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Theme Toggle & Color Picker - Top Right */}
      <div 
        className="absolute top-safe right-safe z-30 flex flex-wrap gap-2 justify-end md:top-4 md:right-4"
        style={{ 
          top: `calc(env(safe-area-inset-top, 0px) + 0.5rem)`,
          right: `calc(env(safe-area-inset-right, 0px) + 0.5rem)`
        }}
      >
        <ColorSlider
          selectedColors={selectedColors}
          onColorChange={setSelectedColors}
          animationSettings={animationSettings}
          onAnimationSettingsChange={setAnimationSettings}
        />
        <ThemeToggle />
      </div>

      <div

        onMouseEnter={triggerBackgroundAnimation}

        onMouseLeave={() => setHovered(false)}

        onTouchStart={(e) => {
          // Don't trigger animation if touching a button or interactive element
          const target = e.target as HTMLElement;
          if (target && (
            target.tagName === 'BUTTON' ||
            target.tagName === 'A' ||
            target.tagName === 'INPUT' ||
            target.tagName === 'TEXTAREA' ||
            target.closest('button') ||
            target.closest('a') ||
            target.closest('[role="button"]') ||
            target.closest('input') ||
            target.closest('textarea') ||
            target.closest('form')
          )) {
            // Don't interfere with button/form interactions
            return;
          }
          triggerBackgroundAnimation();
        }}

        className="relative mx-auto flex h-full w-full flex-col items-stretch justify-start overflow-hidden"

      >

        <div className="relative flex w-full flex-1 flex-col items-center justify-start gap-4 p-3 sm:p-4 lg:p-6 min-h-0">

          <AnimatePresence>

            <div className="tracking-tightest flex select-none flex-col py-2 text-center text-3xl font-extrabold leading-none md:flex-col md:text-8xl lg:flex-row"></div>

            {hovered && (

              <motion.div

                initial={{ opacity: 1 }}

                animate={{ opacity: 1 }}

                exit={{ opacity: 1 }}

                className="absolute inset-0 h-full w-full object-cover"

              >

                <CanvasRevealEffect

                  animationSpeed={animationSettings.animationSpeed}

                  containerClassName="bg-transparent opacity-30 dark:opacity-50"

                  colors={selectedColors}

                  opacities={generateOpacities}

                  dotSize={animationSettings.dotSize}

                  mousePosition={mousePosition}

                  hue={animationSettings.hue}

                  saturation={animationSettings.saturation}

                  contrast={animationSettings.contrast}

                  glow={animationSettings.glow}

                  vibrance={animationSettings.vibrance}

                />

              </motion.div>

            )}

          </AnimatePresence>

          {/* AERIS Logo and Subtext (SOS Active View - Centered) */}
          {isSOSActive && (
            <div className="fixed inset-0 z-[10000] flex flex-col items-center justify-center pointer-events-none">
              <img 
                src={typeof AERISLogo === 'string' ? AERISLogo : AERISLogo.src || '/assets/AERIS LOGO.svg'} 
                alt="AERIS Logo" 
                className="h-24 md:h-32 lg:h-48 w-auto object-contain mb-2"
              />
              <span className="from-gradient-3-start to-gradient-3-end bg-gradient-to-r bg-clip-text px-2 text-transparent text-3xl md:text-4xl lg:text-5xl font-extrabold">
                A.E.R.I.S.
              </span>
              <p className="text-sm md:text-base mt-1 text-foreground dark:text-white">
                Autonomous Emergency Response Intel System
              </p>
            </div>
          )}

          <div className="z-20 w-full flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* AERIS Branding - At Top */}
            {!isSOSActive && (
              <div className="px-3 md:px-3 lg:px-4 py-2 md:py-1.5 lg:py-2 flex-shrink-0">
                <div className="flex flex-col items-center justify-center">
                  <img
                    src={typeof AERISLogo === 'string' ? AERISLogo : AERISLogo.src || '/assets/AERIS LOGO.svg'} 
                    alt="AERIS Logo" 
                    className="h-16 md:h-10 lg:h-12 w-auto object-contain"
                  />
                  <span className="from-gradient-3-start to-gradient-3-end bg-gradient-to-r bg-clip-text px-2 md:px-1 text-transparent text-lg sm:text-xl md:text-sm lg:text-base font-extrabold mt-0.5 md:mt-0.5">
                    A.E.R.I.S.
                  </span>
                  <p className="text-sm md:text-xs lg:text-sm mt-0 md:mt-0.5 text-muted-foreground text-center">
                    Autonomous Emergency Response Intel System
                  </p>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 w-full overflow-auto min-h-0">
              <div className="py-1 md:py-0.5">
                {/* Action Buttons */}
                <div ref={mainButtonsRef} className="max-w-5xl mx-auto mt-3 sm:mt-4 md:mt-1.5 lg:mt-2 px-2 md:px-3 lg:px-4">
                  <div className="flex flex-col gap-3 sm:flex-row md:gap-1.5 lg:gap-2">
                    <GradientButton 
                      className="w-full sm:flex-1 md:text-xs lg:text-sm py-2 md:py-1.5 lg:py-2"
                      colors={selectedColors}
                      onClick={() => setIsHotlinesModalOpen(true)}
                    >
                      EMERGENCY HOTLINES
                    </GradientButton>
                    <GradientButton 
                      className="w-full sm:flex-1 md:text-xs lg:text-sm py-2 md:py-1.5 lg:py-2"
                      style={{
                        background: 'linear-gradient(90deg, #b91c1c 0%, #ef4444 50%, #b91c1c 100%)',
                        backgroundSize: '200% 100%',
                        animation: 'gradient 3s ease infinite',
                        border: 'none'
                      }}
                      colors={[[185, 28, 28], [239, 68, 68], [185, 28, 28]]}
                      onClick={handleSOSCall}
                    >
                      CALL 911
                    </GradientButton>
                    <GradientButton 
                      asChild
                      className="w-full sm:flex-1 md:text-xs lg:text-sm py-2 md:py-1.5 lg:py-2"
                      colors={selectedColors}
                    >
                      <a
                        href="https://forms.gle/sfGgN5HUADUvxhJs8"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        SUBMIT A REPORT
                      </a>
                    </GradientButton>
                  </div>
                </div>
              </div>

              <div id="chat" className="w-full">
                <div className="pt-2 md:pt-2 lg:pt-3 pb-4 md:pb-6 lg:pb-8">
                  <div className="space-y-2 md:space-y-3 overflow-hidden p-2 md:p-3 lg:p-4">
                    {messages.length > 0 ? (
                      <MessageList messages={messages} isLoading={messagesLoading} selectedColors={selectedColors} />
                    ) : messagesLoading ? (
                      <div className="flex items-center justify-center py-8 md:py-12">
                        <div className="animate-spin rounded-full h-8 w-8 md:h-10 md:w-10 border-2 border-primary border-t-transparent"></div>
                      </div>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                </div>
              </div>

            </ScrollArea>

            {/* UwanPH Branding - Above Chat Input */}
            {!isSOSActive && (
              <div className="px-3 md:px-3 lg:px-4 py-2 md:py-1.5 lg:py-2 mb-2 md:mb-1.5 flex-shrink-0">
                <div className="flex flex-col items-center justify-center">
                  <Button
                    variant="default"
                    size="sm"
                    className="mb-2 md:mb-1.5 text-xs md:text-xs lg:text-sm px-4 md:px-3 py-2 md:py-1.5 bg-yellow-500 hover:bg-yellow-600 text-black font-semibold min-h-[44px]"
                    onClick={() => setIsDonationModalOpen(true)}
                  >
                    DONATE
                  </Button>
                  <div className="relative flex h-full w-full justify-center text-center">
                    <h1 className="flex flex-col md:flex-row md:items-end select-none py-1 text-center text-lg sm:text-xl md:text-lg lg:text-xl font-extrabold leading-none tracking-tight">
                      <span
                        data-content="UwanPH"
                        className="before:animate-gradient-background-1 relative before:absolute before:bottom-4 md:before:bottom-1 before:left-0 before:top-0 before:z-0 before:w-full before:px-2 md:before:px-1 before:content-[attr(data-content)] sm:before:top-0 text-4xl sm:text-5xl md:text-3xl lg:text-4xl"
                      >
                        <span className="from-gradient-1-start to-gradient-1-end animate-gradient-foreground-1 bg-gradient-to-r bg-clip-text px-2 md:px-1 text-transparent text-4xl sm:text-5xl md:text-3xl lg:text-4xl">
                          UwanPH
                        </span>
                      </span>
                      <span
                        data-content="CHAT SUPPORT"
                        className="before:animate-gradient-background-2 relative before:absolute before:bottom-0 md:before:bottom-1 before:left-0 before:top-0 before:z-0 before:w-full before:px-2 md:before:px-1 before:content-[attr(data-content)] sm:before:top-0 text-sm md:text-sm lg:text-base"
                      >
                        <span className="from-gradient-2-start to-gradient-2-end animate-gradient-foreground-2 bg-gradient-to-r bg-clip-text px-2 md:px-1 text-transparent text-sm md:text-sm lg:text-base">
                          CHAT SUPPORT
                        </span>
                      </span>
                    </h1>
                  </div>
                  <p className="text-xs md:text-xs lg:text-sm mx-auto mt-0.5 md:mt-0.5 text-center text-muted-foreground md:max-w-2xl">
                    How can I help you today?
                  </p>
                </div>
              </div>
            )}

            <div className="relative mt-2 md:mt-1.5 mb-2 md:mb-2 w-full px-2 md:px-3 lg:px-4 flex-shrink-0 pb-safe-mobile">
              <form onSubmit={handleSubmit}>
                <div className="relative max-w-4xl mx-auto">
                  <Input
                    className="pl-10 md:pl-10 pr-10 md:pr-10 h-12 md:h-9 lg:h-10 text-base md:text-sm lg:text-base min-h-[44px]"
                    placeholder="Ask something with AI"
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    disabled={isSending || messagesLoading}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute left-1 md:left-1 top-1/2 -translate-y-1/2 h-10 w-10 md:h-7 md:w-7 lg:h-8 lg:w-8 rounded-sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0"
                    onClick={handleNewSession}
                    disabled={isSending || messagesLoading}
                  >
                    <Plus className="h-5 w-5 md:h-4 md:w-4 lg:h-4 lg:w-4" />
                    <span className="sr-only">New Chat</span>
                  </Button>
                  <Button
                    type="submit"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 md:right-1 top-1/2 -translate-y-1/2 h-10 w-10 md:h-7 md:w-7 lg:h-8 lg:w-8 rounded-sm min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 z-10 pointer-events-auto"
                    disabled={!messageInput.trim() || isSending || messagesLoading}
                    aria-label="Send message"
                  >
                    {isSending ? (
                      <div className="animate-spin rounded-full h-5 w-5 md:h-4 md:w-4 lg:h-4 lg:w-4 border-2 border-current border-t-transparent"></div>
                    ) : (
                      <Send className="h-5 w-5 md:h-4 md:w-4 lg:h-4 lg:w-4" />
                    )}
                  </Button>
                </div>
              </form>
            </div>

            {/* Footer */}
            <div className="w-full px-2 md:px-3 lg:px-4 pb-2 md:pb-1.5 lg:pb-2 text-center flex-shrink-0">
              <p className="text-xs md:text-xs lg:text-sm text-foreground dark:text-white">
                New Prontera™ All Rights Reserved 2025
              </p>
            </div>

          </div>

        </div>

      </div>

      {/* Emergency Hotlines Modal */}
      <EmergencyHotlinesModal
        isOpen={isHotlinesModalOpen}
        onClose={() => setIsHotlinesModalOpen(false)}
      />

      {/* Donation Wallet Modal */}
      <DonationWalletModal
        isOpen={isDonationModalOpen}
        onClose={() => setIsDonationModalOpen(false)}
      />

      {/* Loading Blob Overlay */}
      <LoadingBlob isLoading={messagesLoading} colors={selectedColors} />

    </div>

  );

}
