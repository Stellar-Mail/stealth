export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden ambient-bg">
      <div
        className="float-orb absolute -top-32 -left-32 h-[480px] w-[480px] rounded-full opacity-40"
        style={{
          background: "radial-gradient(closest-side, oklch(0.6 0.02 270 / 0.5), transparent)",
        }}
      />
      <div
        className="float-orb absolute -bottom-40 right-0 h-[520px] w-[520px] rounded-full opacity-30"
        style={{
          background: "radial-gradient(closest-side, oklch(0.55 0.02 240 / 0.45), transparent)",
          animationDelay: "-6s",
        }}
      />
      <div
        className="float-orb absolute top-1/3 left-1/2 h-[300px] w-[300px] rounded-full opacity-20"
        style={{
          background: "radial-gradient(closest-side, oklch(0.7 0.01 280 / 0.4), transparent)",
          animationDelay: "-3s",
        }}
      />
      {/* subtle noise */}
      <div
        className="absolute inset-0 opacity-[0.035] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='160' height='160'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/></filter><rect width='100%' height='100%' filter='url(%23n)' opacity='0.6'/></svg>\")",
        }}
      />
    </div>
  );
}
