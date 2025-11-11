"use client";

import React, { useState } from "react";
import { X, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";

interface DonationWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const WALLET_ADDRESS = "0xf4526c10dfdeaf7c4b8942793373cb0b139e60db";

// Generate QR code URL using a QR code service
const getQRCodeUrl = (address: string, dark: boolean = false) => {
  const bgColor = dark ? "000000" : "FFFFFF";
  const fgColor = dark ? "FFFFFF" : "000000";
  return `https://api.qrserver.com/v1/create-qr-code/?size=256x256&bgcolor=${bgColor}&color=${fgColor}&data=${encodeURIComponent(address)}`;
};

export function DonationWalletModal({ isOpen, onClose }: DonationWalletModalProps) {
  const [copied, setCopied] = useState(false);
  const { resolvedTheme } = useTheme();
  
  // Generate QR code URL based on theme
  const qrImageUrl = getQRCodeUrl(WALLET_ADDRESS, resolvedTheme === "dark");

  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(WALLET_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy address:", err);
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = WALLET_ADDRESS;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (fallbackErr) {
        console.error("Fallback copy failed:", fallbackErr);
      }
      document.body.removeChild(textArea);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center p-4 pointer-events-none">
        <div
          className={cn(
            "bg-background border border-border rounded-lg shadow-xl",
            "w-full max-w-md",
            "flex flex-col",
            "pointer-events-auto",
            "animate-in fade-in-0 zoom-in-95 duration-200",
            "overflow-hidden"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-border flex-shrink-0">
            <h2 className="text-xl md:text-2xl font-bold text-foreground">
              Donation Wallet
            </h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8 md:h-10 md:w-10"
            >
              <X className="h-4 w-4 md:h-5 md:w-5" />
              <span className="sr-only">Close</span>
            </Button>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-6">
            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-card border border-border rounded-lg p-4 md:p-6 shadow-sm">
                <img
                  src={qrImageUrl}
                  alt="Ethereum Wallet QR Code"
                  className="w-48 h-48 md:w-64 md:h-64 object-contain"
                  onError={(e) => {
                    // Fallback if QR code service fails
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            </div>

            {/* Wallet Info */}
            <div className="space-y-3">
              <div className="text-center">
                <h3 className="text-lg md:text-xl font-semibold text-foreground mb-1">
                  ERC20 Address
                </h3>
                <p className="text-sm text-muted-foreground">
                  Use this address to send crypto from any EVM blockchain.
                </p>
              </div>

              {/* Address Display */}
              <div className="bg-card border border-border rounded-lg p-4">
                <div className="flex flex-col gap-3">
                  <button
                    onClick={handleCopyAddress}
                    className="break-all text-sm md:text-base font-mono text-foreground text-center hover:text-primary transition-colors cursor-pointer active:opacity-70"
                    title="Tap to copy"
                  >
                    {WALLET_ADDRESS.slice(0, 26)}
                    <br />
                    {WALLET_ADDRESS.slice(26)}
                  </button>
                  
                  {/* Copy Button */}
                  <Button
                    onClick={handleCopyAddress}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    {copied ? (
                      <>
                        <Check className="h-4 w-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        <span>Copy address</span>
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Network Info */}
              <div className="text-center">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Networks: <span className="font-medium text-foreground">ETH - BASE - BNB - ARB - POL</span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

