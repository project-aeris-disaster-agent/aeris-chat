"use client";

import React, { useState } from "react";
import { X, ExternalLink, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTheme } from "@/contexts/ThemeContext";
import aerisAdsBanner from "@/assets/ads_v1_2026.gif";
import adsBanner from "@/assets/ads_v2_2026.gif";
import bagyoLogo from "@/assets/Bagyo Logo@5x.png";

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

  const handleOpenMetaMask = () => {
    window.open(
      `https://metamask.app.link/send/${WALLET_ADDRESS}`,
      "_blank",
      "noopener,noreferrer",
    );
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
          <div className="border-b border-border px-4 py-3 md:px-6 md:py-4 flex-shrink-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <img
                  src={typeof bagyoLogo === "string" ? bagyoLogo : bagyoLogo.src}
                  alt="bagyo.app"
                  className="h-6 w-auto shrink-0 object-contain"
                />
                <h2 className="truncate text-lg font-bold leading-tight text-foreground md:text-xl">
                  Donation Wallet
                </h2>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="h-8 w-8 shrink-0 md:h-10 md:w-10"
              >
                <X className="h-4 w-4 md:h-5 md:w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </div>
            <p className="mt-1 text-xs leading-snug text-muted-foreground md:text-sm">
              Crypto donations support disaster information and relief efforts.
            </p>
          </div>

          {/* Content */}
          <div className="p-4 md:p-6 space-y-6">
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <img
                src={typeof adsBanner === "string" ? adsBanner : adsBanner.src}
                alt="Report. Respond. Rebuild. Together."
                className="h-auto w-full max-h-32 object-contain object-center md:max-h-36"
              />
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div className="bg-card border border-border rounded-lg p-3 md:p-5 shadow-sm">
                <img
                  src={qrImageUrl}
                  alt="Ethereum Wallet QR Code"
                  className="w-40 h-40 md:w-52 md:h-52 object-contain"
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

              {/* Network Info */}
              <div className="text-center">
                <p className="text-xs md:text-sm text-muted-foreground">
                  Networks: <span className="font-medium text-foreground">ETH - BASE - BNB - ARB - POL</span>
                </p>
              </div>

              {/* Address Display */}
              <div className="bg-card border border-border rounded-lg p-3 md:p-4">
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={handleCopyAddress}
                    className="flex w-full min-w-0 items-center gap-2 rounded-md px-1 py-0.5 text-left hover:text-primary transition-colors cursor-pointer active:opacity-70"
                    title="Tap to copy"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-mono text-muted-foreground">
                      {WALLET_ADDRESS}
                    </span>
                    {copied ? (
                      <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    )}
                    <span className="sr-only">{copied ? "Copied" : "Copy address"}</span>
                  </button>

                  <Button
                    onClick={handleOpenMetaMask}
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    <span>Open MetaMask</span>
                  </Button>
                </div>
              </div>

              <div
                aria-label="Advertisement"
                className="overflow-hidden rounded-lg border border-border bg-card"
              >
                <img
                  src={typeof aerisAdsBanner === "string" ? aerisAdsBanner : aerisAdsBanner.src}
                  alt="Para sa impormasyon at tulong — disaster information and relief"
                  className="block h-auto w-full min-w-0 object-contain"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

