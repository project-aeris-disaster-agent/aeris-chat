"use client";

import React from "react"; 

import { CanvasRevealEffect } from "@/components/ui/canvas-effect";

import { Plus, Send } from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";

import { Button } from "@/components/ui/button";

import { Input } from "@/components/ui/input";

import { ScrollArea } from "@/components/ui/scroll-area";

import { ThemeToggle } from "@/components/ui/theme-toggle";

import { ColorSlider, AnimationSettings } from "@/components/ui/color-slider";

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
    animationSpeed: 0.1,
    opacityMin: 0.5,
    opacityMax: 1.0,
    dotSize: 6,
    hue: 0,
    saturation: 1.0,
    contrast: 1.0,
    glow: 0.0,
  });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
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
      const newSession = await createSession();
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
        const newSession = await createSession();
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
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Restore message on error
      setMessageInput(messageToSend);
      alert(`Error: ${error instanceof Error ? error.message : 'Failed to send message'}`);
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

  return (

    <div ref={containerRef} className="relative h-full w-full flex flex-col">

      {/* SOS Button - Top Left */}
      <SOSButton isActive={isSOSActive} onToggleSOS={() => setIsSOSActive((prev) => !prev)} />

      {/* Theme Toggle & Color Picker - Top Right */}
      <div className="absolute top-2 right-2 md:top-4 md:right-4 z-30 flex gap-2">
        <ColorSlider
          selectedColors={selectedColors}
          onColorChange={setSelectedColors}
          animationSettings={animationSettings}
          onAnimationSettingsChange={setAnimationSettings}
        />
        <ThemeToggle />
      </div>

      <div

        onMouseEnter={() => setHovered(true)}

        onMouseLeave={() => setHovered(false)}

        className="relative mx-auto w-full h-full flex flex-col items-center justify-center overflow-hidden"

      >

        <div className="relative flex w-full h-full flex-col items-center justify-center p-2 md:p-4">

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

          <div className="z-20 w-full flex-1 flex flex-col min-h-0">

            {/* AERIS Branding - At Top */}
            {!isSOSActive && (
              <div className="px-3 md:px-6 py-2">
                <div className="flex flex-col items-center justify-center">
                  <img 
                    src={typeof AERISLogo === 'string' ? AERISLogo : AERISLogo.src || '/assets/AERIS LOGO.svg'} 
                    alt="AERIS Logo" 
                    className="h-16 md:h-20 lg:h-28 w-auto object-contain"
                  />
                  <span className="from-gradient-3-start to-gradient-3-end bg-gradient-to-r bg-clip-text px-2 text-transparent text-xl md:text-2xl lg:text-3xl font-extrabold mt-0.5">
                    A.E.R.I.S.
                  </span>
                  <p className="text-sm md:text-base mt-0 text-muted-foreground">
                    Autonomous Emergency Response Intel System
                  </p>
                </div>
              </div>
            )}

            <ScrollArea className="flex-1 w-full overflow-auto md:h-[360px]">

              <div className="px-3 md:px-6 py-1">

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 md:gap-4 justify-center items-center mt-4 md:mt-6 px-3">
                  <GradientButton 
                    className="w-full sm:w-auto sm:min-w-[160px]"
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
                    className="w-full sm:w-auto sm:min-w-[160px]"
                    colors={selectedColors}
                    onClick={() => setIsHotlinesModalOpen(true)}
                  >
                    EMERGENCY HOTLINES
                  </GradientButton>
                  <GradientButton 
                    className="w-full sm:w-auto sm:min-w-[160px]"
                    colors={selectedColors}
                  >
                    REPORT INCIDENT
                  </GradientButton>
                </div>

              </div>

              <div id="chat" className="w-full min-h-[200px]">

                <div className="pt-2 md:pt-4">

                  <div className="space-y-2 overflow-hidden p-2">
                    {messages.length > 0 ? (
                      <MessageList messages={messages} isLoading={messagesLoading} selectedColors={selectedColors} />
                    ) : messagesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary border-t-transparent"></div>
                      </div>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>

                </div>

              </div>

            </ScrollArea>

            {/* UwanPH Branding - Above Chat Input */}
            {!isSOSActive && (
              <div className="px-3 md:px-6 py-2 mb-2">
                <div className="flex flex-col items-center justify-center">
                  <Button
                    variant="default"
                    size="sm"
                    className="mb-2 text-xs md:text-sm bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
                    onClick={() => setIsDonationModalOpen(true)}
                  >
                    DONATE
                  </Button>
                  <div className="relative flex h-full w-full justify-center text-center">
                    <h1 className="flex flex-col md:flex-row select-none py-1 text-center text-xl md:text-2xl lg:text-4xl font-extrabold leading-none tracking-tight">
                      <span
                        data-content="UwanPH"
                        className="before:animate-gradient-background-1 relative before:absolute before:bottom-4 before:left-0 before:top-0 before:z-0 before:w-full before:px-2 before:content-[attr(data-content)] sm:before:top-0 text-6xl md:text-7xl lg:text-9xl"
                      >
                        <span className="from-gradient-1-start to-gradient-1-end animate-gradient-foreground-1 bg-gradient-to-r bg-clip-text px-2 text-transparent text-6xl md:text-7xl lg:text-9xl">
                          UwanPH
                        </span>
                      </span>
                      <span
                        data-content="CHAT SUPPORT"
                        className="before:animate-gradient-background-2 relative before:absolute before:bottom-0 before:left-0 before:top-0 before:z-0 before:w-full before:px-2 before:content-[attr(data-content)] sm:before:top-0"
                      >
                        <span className="from-gradient-2-start to-gradient-2-end animate-gradient-foreground-2 bg-gradient-to-r bg-clip-text px-2 text-transparent">
                          CHAT SUPPORT
                        </span>
                      </span>
                    </h1>
                  </div>
                  <p className="text-xs md:text-sm mx-auto mt-0.5 text-center text-muted-foreground md:max-w-2xl">
                    How can I help you today?
                  </p>
                </div>
              </div>
            )}

            <div className="relative mt-2 mb-4 md:mb-0 w-full px-2 md:px-0" style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom, 1rem))' }}>

              <form onSubmit={handleSubmit}>

                <div className="relative">

                  <Input

                    className="pl-10 md:pl-12 pr-10 md:pr-12 h-10 md:h-11 text-sm md:text-base"

                    placeholder="Ask something with AI"

                    value={messageInput}

                    onChange={(e) => setMessageInput(e.target.value)}

                    disabled={isSending || messagesLoading}

                  />

                  <Button

                    type="button"

                    variant="ghost"

                    size="icon"

                    className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 md:h-8 md:w-8 rounded-sm"

                    onClick={handleNewSession}

                    disabled={isSending || messagesLoading}

                  >

                    <Plus className="h-4 w-4 md:h-5 md:w-5" />

                    <span className="sr-only">New Chat</span>

                  </Button>

                  <Button

                    type="submit"

                    variant="ghost"

                    size="icon"

                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 md:h-8 md:w-8 rounded-sm"

                    disabled={!messageInput.trim() || isSending || messagesLoading}

                  >

                    {isSending ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-current border-t-transparent"></div>
                    ) : (
                      <Send className="h-4 w-4" />
                    )}

                  </Button>

                </div>

              </form>

            </div>

            {/* Footer */}
            <div className="w-full px-2 md:px-0 pb-2 md:pb-4 text-center">
              <p className="text-xs md:text-sm text-foreground dark:text-white">
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

    </div>

  );

}
