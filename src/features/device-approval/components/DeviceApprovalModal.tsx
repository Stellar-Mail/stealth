import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Check,
  X,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  Smartphone,
  Globe,
  Clock,
  RefreshCw,
  Wifi,
  AlertCircle,
  Send,
  Fingerprint,
  Terminal
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motionPresets } from "@/lib/motion-presets";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { Button } from "@/components/ui/button";
import type {
  DeviceApprovalRequest,
  ApprovalAction,
  VerificationState,
} from "../types";

interface DeviceApprovalModalProps {
  request: DeviceApprovalRequest;
  isOpen: boolean;
  onClose: () => void;
  onAction: (requestId: string, action: ApprovalAction) => void;
  onVerifyOTP?: (requestId: string, otp: string) => Promise<boolean>;
}

export function DeviceApprovalModal({
  request,
  isOpen,
  onClose,
  onAction,
  onVerifyOTP,
}: DeviceApprovalModalProps) {
  const [otp, setOtp] = useState("");
  const [verificationState, setVerificationState] = useState<VerificationState>("idle");
  const [timeLeft, setTimeLeft] = useState<number>(0);

  // Calculate initial time left
  const calculateTimeLeft = useCallback(() => {
    const now = new Date();
    const diff = request.relayChallenge.expiresAt.getTime() - now.getTime();
    return Math.max(0, Math.floor(diff / 1000));
  }, [request.relayChallenge.expiresAt]);

  // Check if challenge is expired
  const isExpired = useMemo(() => {
    return calculateTimeLeft() <= 0;
  }, [calculateTimeLeft]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen) return;

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      const newTimeLeft = calculateTimeLeft();
      setTimeLeft(newTimeLeft);
      if (newTimeLeft <= 0) {
        setVerificationState("expired");
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, calculateTimeLeft]);

  const formatTimeLeft = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleVerifyOTP = async () => {
    if (isExpired) return;
    
    setVerificationState("pending");
    
    if (onVerifyOTP) {
      try {
        const success = await onVerifyOTP(request.id, otp);
        setVerificationState(success ? "success" : "failure");
        if (success) {
          setTimeout(() => {
            onAction(request.id, "approve");
            onClose();
          }, 1500);
        }
      } catch {
        setVerificationState("failure");
      }
    } else {
      // Simulate verification if no handler provided
      setTimeout(() => {
        setVerificationState("success");
        setTimeout(() => {
          onAction(request.id, "approve");
          onClose();
        }, 1500);
      }, 1500);
    }
  };

  const handleDeny = () => {
    onAction(request.id, "deny");
    onClose();
  };

  const handleReport = () => {
    onAction(request.id, "report");
    onClose();
  };

  const handleRetry = () => {
    setVerificationState("idle");
    setOtp("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px] p-0 overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key="modal-content"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-4 border-b border-white/10">
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "grid h-12 w-12 place-items-center rounded-xl",
                    isExpired ? "bg-amber-500/15 text-amber-400" : "bg-blue-500/15 text-blue-400"
                  )}>
                    {isExpired ? (
                      <AlertTriangle className="h-6 w-6" />
                    ) : (
                      <ShieldAlert className="h-6 w-6" />
                    )}
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-xl font-semibold">
                      {isExpired ? "Challenge Expired" : "New Device Request"}
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground mt-1">
                      {isExpired
                        ? "This verification challenge has expired"
                        : "A new device is requesting access to your account"}
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-6">
              {/* Expired State */}
              {isExpired && (
                <motion.div
                  key="expired-state"
                  {...motionPresets.entrance.fadeIn()}
                  className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-amber-400">Challenge Expired</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        The verification window for this request has closed. Please request a new challenge if you still want to approve this device.
                      </p>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Device Info */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Smartphone className="h-4 w-4" />
                  Device Information
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <InfoItem label="Device" value={request.deviceMetadata.deviceName} />
                  <InfoItem label="Type" value={request.deviceMetadata.deviceType} />
                  <InfoItem label="Browser" value={request.deviceMetadata.browser} />
                  <InfoItem label="OS" value={request.deviceMetadata.operatingSystem} />
                  <InfoItem label="IP Address" value={request.deviceMetadata.ipAddress} />
                  <InfoItem label="Location" value={request.deviceMetadata.location} />
                </div>
              </div>

              {/* Relay Source */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Wifi className="h-4 w-4" />
                  Relay Source
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4 text-muted-foreground" />
                    <code className="text-xs font-mono text-muted-foreground">
                      {request.relayChallenge.relaySource}
                    </code>
                  </div>
                </div>
              </div>

              {/* Wallet Identity */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Fingerprint className="h-4 w-4" />
                  Wallet Identity
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-emerald-500/20 grid place-items-center">
                        <ShieldCheck className="h-4 w-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground/80">
                          {request.walletIdentity.network}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground truncate max-w-[280px]">
                          {request.walletIdentity.address}
                        </p>
                      </div>
                    </div>
                    {request.walletIdentity.balance && (
                      <span className="text-xs font-medium text-foreground/70">
                        {request.walletIdentity.balance}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Permissions */}
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                  <Globe className="h-4 w-4" />
                  Requested Permissions
                </div>
                <div className="space-y-2">
                  {request.permissions.map((perm) => (
                    <div
                      key={perm.id}
                      className="flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 p-3"
                    >
                      <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground/80">
                          {perm.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {perm.description}
                        </p>
                      </div>
                      {perm.required && (
                        <span className="text-[10px] uppercase tracking-wider text-amber-400 font-medium">
                          Required
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Expiry Timer */}
              {!isExpired && (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 p-3">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Expires in
                    </span>
                  </div>
                  <span className={cn(
                    "font-mono text-sm font-semibold tabular-nums",
                    timeLeft < 60 ? "text-amber-400" : "text-foreground/80"
                  )}>
                    {formatTimeLeft(timeLeft)}
                  </span>
                </div>
              )}

              {/* OTP Input */}
              {!isExpired && verificationState !== "success" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground/80">
                    <Send className="h-4 w-4" />
                    Verification Code
                  </div>
                  <div className="flex flex-col items-center gap-3">
                    <InputOTP
                      maxLength={6}
                      value={otp}
                      onChange={setOtp}
                      disabled={verificationState === "pending"}
                    >
                      <InputOTPGroup>
                        <InputOTPSlot index={0} />
                        <InputOTPSlot index={1} />
                        <InputOTPSlot index={2} />
                        <InputOTPSlot index={3} />
                        <InputOTPSlot index={4} />
                        <InputOTPSlot index={5} />
                      </InputOTPGroup>
                    </InputOTP>
                    {verificationState === "failure" && (
                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="text-sm text-rose-400 flex items-center gap-1.5"
                      >
                        <X className="h-4 w-4" />
                        Invalid code. Please try again.
                      </motion.p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col gap-2 pt-2">
                {!isExpired && verificationState === "success" ? (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500/15 border border-emerald-500/25 p-4"
                  >
                    <Check className="h-5 w-5 text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-400">
                      Verified! Approving device...
                    </span>
                  </motion.div>
                ) : isExpired ? (
                  <Button
                    onClick={onClose}
                    className="w-full"
                    variant="default"
                  >
                    Close
                  </Button>
                ) : (
                  <>
                    {verificationState === "failure" ? (
                      <Button
                        onClick={handleRetry}
                        className="w-full"
                        variant="default"
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Try Again
                      </Button>
                    ) : verificationState !== "success" ? (
                      <Button
                        onClick={handleVerifyOTP}
                        disabled={otp.length < 6 || verificationState === "pending"}
                        className="w-full bg-emerald-500 hover:bg-emerald-500/90 text-black"
                      >
                        {verificationState === "pending" ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Verifying...
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Verify & Approve
                          </>
                        )}
                      </Button>
                    ) : null}
                    {verificationState !== "success" && (
                      <div className="flex gap-2">
                        <Button
                          onClick={handleDeny}
                          className="flex-1"
                          variant="secondary"
                        >
                          <X className="h-4 w-4 mr-2" />
                          Deny
                        </Button>
                        <Button
                          onClick={handleReport}
                          className="flex-1"
                          variant="destructive"
                        >
                          <ShieldAlert className="h-4 w-4 mr-2" />
                          Report
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">
        {label}
      </p>
      <p className="text-sm text-foreground/80 truncate">{value}</p>
    </div>
  );
}
