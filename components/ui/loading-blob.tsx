"use client";

import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { AnimatedBlobs } from "./animated-blobs";
import { cn } from "@/lib/utils";

interface LoadingBlobProps {
  isLoading: boolean;
  colors?: number[][];
  className?: string;
}

export function LoadingBlob({ isLoading, colors, className }: LoadingBlobProps) {
  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          key="loading-blob-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
          className={cn(
            "fixed inset-0 z-[10000] flex flex-col items-center justify-center gap-4 pointer-events-none",
            className
          )}
        >
          <AnimatedBlobs
            colors={colors}
            size="40vmin"
            speedSeconds={5}
            blur="1vmin"
            className="pointer-events-none"
          />
          <p className="text-sm md:text-base font-medium text-muted-foreground">AI is thinking...</p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

