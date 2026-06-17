import { createFileRoute } from "@tanstack/react-router";
import { MailQuestion } from "lucide-react";
import { SenderRequestFlow } from "@/features/sender-request/SenderRequestFlow";

export const Route = createFileRoute("/send")({
  head: () => ({
    meta: [
      { title: "Send a message — Stealth" },
      {
        name: "description",
        content:
          "Send a verifiable message to a Stealth address. Review delivery policy and postage terms before committing.",
      },
    ],
  }),
  component: SendPage,
});

function SendPage() {
  return (
    <div className="ambient-bg flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-2 text-center">
          <span className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/[0.04]">
            <MailQuestion className="size-5 text-muted-foreground" aria-hidden />
          </span>
          <h1 className="text-lg font-semibold text-foreground">Stealth</h1>
          <p className="max-w-[320px] text-xs text-muted-foreground">
            A private mail protocol. Verify your identity, attach optional postage, and reach your
            recipient without an account.
          </p>
        </div>

        {/* Flow card */}
        <div className="glass-strong w-full rounded-2xl p-6">
          <SenderRequestFlow />
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-[10px] text-muted-foreground/50">
          Your message content is end-to-end encrypted and never stored on-chain.
        </p>
      </div>
    </div>
  );
}
