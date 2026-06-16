import { useState } from "react";
import { motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import "../styles.css";

export function OTPCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const digits = code.split("");

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  return (
    <div className="otp-scene my-7 flex justify-center overflow-hidden rounded-[18px] px-5 py-7 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 12, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
        className="otp-card relative w-full max-w-[340px] overflow-hidden rounded-[14px] px-6 pb-6 pt-5"
      >
        <div className="mb-4 flex justify-center">
          <PadlockIcon />
        </div>

        <h3 className="text-center text-[15px] font-medium text-foreground">
          Your verification code
        </h3>
        <p className="mx-auto mt-1 max-w-[260px] text-center text-[11.5px] leading-[16px] text-muted-foreground">
          We&rsquo;ve detected a unique passkey in this email. Copy it to use anywhere.
        </p>

        <div className="mt-5 flex items-center justify-center gap-2">
          {digits.map((digit, i) => (
            <div
              key={i}
              className="otp-digit grid h-10 w-9 place-items-center rounded-md font-mono text-[16px] font-semibold tabular-nums text-foreground"
            >
              {digit}
            </div>
          ))}
        </div>

        <button
          onClick={handleCopy}
          className="otp-copy-btn mt-5 flex h-10 w-full items-center justify-center gap-2 rounded-full text-[13px] font-semibold"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy code
            </>
          )}
        </button>

        <p className="mt-3 text-center text-[10.5px] text-muted-foreground/80">
          Code auto-detected from message body
        </p>
      </motion.div>
    </div>
  );
}

function PadlockIcon() {
  return (
    <svg
      width="76"
      height="86"
      viewBox="0 0 76 86"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="shackle" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#dcdfe3" />
          <stop offset="0.5" stopColor="#9aa0a8" />
          <stop offset="1" stopColor="#5a6068" />
        </linearGradient>
        <linearGradient id="dial" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e6e8ec" />
          <stop offset="0.45" stopColor="#a8aeb6" />
          <stop offset="1" stopColor="#3d424a" />
        </linearGradient>
        <radialGradient id="dialFace" cx="0.5" cy="0.4" r="0.6">
          <stop offset="0" stopColor="#3a3f47" />
          <stop offset="1" stopColor="#15181c" />
        </radialGradient>
        <linearGradient id="knob" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#f0f2f5" />
          <stop offset="1" stopColor="#7a8088" />
        </linearGradient>
      </defs>
      <path
        d="M20 38 V24 C20 12 28 4 38 4 C48 4 56 12 56 24 V38"
        stroke="url(#shackle)"
        strokeWidth="7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="38" cy="56" r="26" fill="url(#dial)" />
      <circle cx="38" cy="56" r="22" fill="url(#dialFace)" />
      {Array.from({ length: 24 }).map((_, i) => {
        const angle = (i * 360) / 24;
        const rad = (angle * Math.PI) / 180;
        const r1 = 19;
        const r2 = 21.4;
        const x1 = 38 + r1 * Math.cos(rad);
        const y1 = 56 + r1 * Math.sin(rad);
        const x2 = 38 + r2 * Math.cos(rad);
        const y2 = 56 + r2 * Math.sin(rad);
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#cfd3d8"
            strokeOpacity={i % 6 === 0 ? 0.95 : 0.45}
            strokeWidth={i % 6 === 0 ? 1.2 : 0.7}
          />
        );
      })}
      <circle cx="38" cy="56" r="6" fill="url(#knob)" />
      <circle cx="38" cy="55" r="1.6" fill="#1a1d22" />
      <path d="M38 36 L36 41 L40 41 Z" fill="#e8eaee" />
    </svg>
  );
}
