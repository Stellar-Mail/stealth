import { Shield, Mail, Zap, Key } from "lucide-react";
import { AmbientBackground } from "@/components/mail/AmbientBackground";

interface LandingScreenProps {
  onConnectWallet: () => void;
  onExploreDemo: () => void;
}

export function LandingScreen({ onConnectWallet, onExploreDemo }: LandingScreenProps) {
  return (
    <div className="relative min-h-screen text-foreground flex flex-col items-center justify-center p-6 overflow-hidden">
      <AmbientBackground />
      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center space-y-12">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="inline-flex items-center justify-center p-3 mb-4 rounded-2xl bg-glass-strong border border-border shadow-lg">
            <Mail className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-foreground">
            Stealth Mail
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto">
            A cryptographic mail client built on Stellar. Send messages with mathematical certainty.
          </p>
        </div>

        {/* Feature Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-3xl">
          <FeatureCard
            icon={<Shield className="w-6 h-6 text-primary" />}
            title="End-to-End Encrypted"
            description="Your messages are secured by cryptography. Only you and the recipient can read them."
          />
          <FeatureCard
            icon={<Key className="w-6 h-6 text-primary" />}
            title="Cryptographic Identity"
            description="No passwords to steal. Your Stellar wallet acts as your unforgeable mail identity."
          />
          <FeatureCard
            icon={<Zap className="w-6 h-6 text-primary" />}
            title="Delivery Proofs"
            description="Every message sent provides cryptographic proof of delivery through the network."
          />
        </div>

        {/* Call to Actions */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-8 w-full max-w-md mx-auto">
          <button
            onClick={onConnectWallet}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-lg transition-transform hover:scale-105 hover:bg-primary/90"
          >
            Connect Wallet
          </button>
          <button
            onClick={onExploreDemo}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-glass px-8 py-4 text-base font-medium text-foreground border border-border shadow-sm transition-colors hover:bg-muted"
          >
            Explore Demo Inbox
          </button>
        </div>

        <div className="pt-12">
          <a
            href="/docs"
            className="inline-flex items-center text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Read Protocol Docs <span className="ml-1">→</span>
          </a>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center p-6 text-center rounded-2xl bg-glass border border-border">
      <div className="mb-4 p-3 rounded-full bg-background border border-border shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}
