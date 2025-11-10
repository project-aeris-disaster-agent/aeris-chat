"use client";

import { Chatbot } from "@/components/chat/Chatbot";

export default function ChatPage() {
  return (
    <div className="min-h-screen w-full bg-background transition-colors md:flex md:items-center md:justify-center md:p-4">
      <div className="h-screen w-full md:h-auto md:max-w-4xl md:rounded-lg md:shadow-lg md:border md:border-border overflow-hidden">
        <Chatbot />
      </div>
    </div>
  );
}
