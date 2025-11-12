"use client";

import { Chatbot } from "@/components/chat/Chatbot";

export default function ChatPage() {
  return (
    <div className="h-viewport w-full bg-background transition-colors flex flex-col items-stretch overflow-hidden md:flex md:items-center md:justify-center md:p-6 lg:p-8">
      <div className="flex flex-col w-full h-full md:h-[90vh] md:max-h-[900px] md:max-w-6xl lg:max-w-7xl md:w-full md:rounded-xl md:shadow-2xl md:border md:border-border overflow-hidden">
        <Chatbot />
      </div>
    </div>
  );
}
