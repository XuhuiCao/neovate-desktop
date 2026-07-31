import { XIcon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export function ImageOverlay({
  src,
  alt,
  children,
}: {
  src: string;
  alt?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {children}
      </span>
      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              role="dialog"
              aria-label="Close image viewer"
              tabIndex={-1}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-50 flex flex-col items-center bg-black/60 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            >
              <div className="flex w-full justify-end p-4">
                <button
                  type="button"
                  aria-label="Close"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                  }}
                  className="rounded-full p-2 text-white/80 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <XIcon className="h-5 w-5" />
                </button>
              </div>
              <div className="flex flex-1 items-center justify-center px-16">
                <motion.img
                  src={src}
                  alt={alt}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="max-h-[calc(100vh-8rem)] max-w-full object-contain"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  );
}
