import { motion, AnimatePresence } from "framer-motion";
import { Reply, ReplyAll, Forward, Star, Archive, Trash2, MoreHorizontal, Paperclip, Sparkles } from "lucide-react";
import type { Email } from "./data";

export function EmailView({ email }: { email: Email | null }) {
  return (
    <section className="glass relative m-3 ml-0 flex h-[calc(100vh-1.5rem-3.5rem-0.75rem)] flex-1 flex-col overflow-hidden rounded-2xl">
      <AnimatePresence mode="wait">
        {!email ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 items-center justify-center p-10 text-center"
          >
            <div>
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04]">
                <Sparkles className="h-5 w-5 text-muted-foreground" />
              </div>
              <h3 className="text-sm font-medium text-foreground">No conversation selected</h3>
              <p className="mt-1 text-xs text-muted-foreground">Pick a thread from the list to read it here.</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key={email.id}
            initial={{ opacity: 0, y: 8, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(8px)" }}
            transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
            className="flex h-full flex-col"
          >
            {/* toolbar */}
            <div className="flex items-center gap-1 border-b border-white/5 px-4 py-2.5">
              {[Archive, Trash2, Star].map((Icon, i) => (
                <motion.button key={i} whileTap={{ scale: 0.9 }} className="rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground">
                  <Icon className="h-4 w-4" />
                </motion.button>
              ))}
              <div className="mx-1 h-6 w-px bg-white/10" />
              {[
                { icon: Reply, label: "Reply" },
                { icon: ReplyAll, label: "Reply all" },
                { icon: Forward, label: "Forward" },
              ].map(({ icon: Icon, label }) => (
                <motion.button
                  key={label}
                  whileTap={{ scale: 0.96 }}
                  whileHover={{ y: -1 }}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground"
                >
                  <Icon className="h-3.5 w-3.5" /> {label}
                </motion.button>
              ))}
              <button className="ml-auto rounded-lg p-2 text-muted-foreground transition hover:bg-white/[0.06] hover:text-foreground">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </div>

            <div className="scrollbar-thin flex-1 overflow-y-auto p-6">
              <h1 className="text-xl font-semibold tracking-tight text-foreground">{email.subject}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                {email.labels?.map((l) => (
                  <span key={l} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                    {l}
                  </span>
                ))}
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-xs font-medium text-white/90"
                     style={{ background: `linear-gradient(135deg, ${email.avatarColor}, #1a1a1d)` }}>
                  {email.from.split(" ").map(n => n[0]).slice(0,2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{email.from} <span className="text-muted-foreground">&lt;{email.email}&gt;</span></div>
                  <div className="text-[11px] text-muted-foreground">to me · {email.time}</div>
                </div>
              </div>

              <div className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap text-[14.5px] leading-relaxed text-foreground/90">
                {email.body}
              </div>

              {email.attachments?.length ? (
                <div className="mt-6">
                  <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                    <Paperclip className="h-3 w-3" /> {email.attachments.length} attachment{email.attachments.length > 1 ? "s" : ""}
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {email.attachments.map((a) => (
                      <motion.div
                        key={a.name}
                        whileHover={{ y: -2 }}
                        className="glass-hover flex items-center gap-3 rounded-xl border border-white/5 p-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.05] text-[10px] font-bold uppercase text-muted-foreground">
                          {a.type}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-xs font-medium text-foreground">{a.name}</div>
                          <div className="text-[11px] text-muted-foreground">{a.size}</div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* AI Smart reply */}
              <div className="mt-8 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                <div className="mb-2 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles className="h-3 w-3" /> Smart reply
                </div>
                <div className="flex flex-wrap gap-2">
                  {["Sounds good — let's review Friday.", "Can we push to next week?", "Thanks, looks great."].map((s) => (
                    <motion.button
                      key={s}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-white/[0.08]"
                    >
                      {s}
                    </motion.button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
