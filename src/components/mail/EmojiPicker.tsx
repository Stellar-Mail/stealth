import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const emojiCategories = {
  smileys: ["😊", "😂", "🥹", "😍", "🤔", "😅", "😎", "🙃", "😏", "🤗", "🫡", "🤝"],
  gestures: ["👍", "👎", "👏", "🙌", "🤞", "✌️", "🤟", "👋", "💪", "🫶", "👀", "🔥"],
  objects: ["💡", "📎", "📧", "💻", "📱", "⏰", "📅", "✅", "❌", "⭐", "💯", "🎯"],
  symbols: ["❤️", "💙", "💚", "💜", "🖤", "💔", "✨", "⚡", "🌟", "💫", "🎉", "🎊"],
};

type Category = keyof typeof emojiCategories;

export function EmojiPicker({
  open,
  onClose,
  onSelect,
}: {
  open: boolean;
  onClose: () => void;
  onSelect: (emoji: string) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<Category>("smileys");

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
            className="glass-strong absolute bottom-full left-0 z-50 mb-2 w-72 overflow-hidden rounded-xl"
          >
            {/* Category tabs */}
            <div className="flex border-b border-white/5 px-2 pt-2">
              {(Object.keys(emojiCategories) as Category[]).map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "flex-1 rounded-t-lg px-2 py-1.5 text-[10px] capitalize transition",
                    activeCategory === cat
                      ? "bg-white/[0.08] text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Emoji grid */}
            <div className="grid grid-cols-6 gap-1 p-2">
              {emojiCategories[activeCategory].map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSelect(emoji);
                    onClose();
                  }}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-lg transition hover:bg-white/[0.08]"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
