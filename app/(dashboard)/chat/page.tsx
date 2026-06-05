"use client";

import { Chatbot } from "@/components/chat/Chatbot";

export default function ChatPage() {
  return (
    <div className="h-app w-full overflow-hidden bg-background transition-colors md:flex md:items-center md:justify-center md:p-4">
      <div className="h-full w-full md:h-[calc(100dvh-2rem)] md:max-w-4xl md:rounded-lg md:shadow-lg md:border md:border-border overflow-hidden">
        <Chatbot />
      </div>
    </div>
  );
}
