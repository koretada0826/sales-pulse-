import React, { useEffect, useState } from 'react';

export default function CelebrateBanner({ event, onClose }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!event) return;
    const enter = requestAnimationFrame(() => setShow(true));
    const hideAt = setTimeout(() => setShow(false), 3800);
    const removeAt = setTimeout(() => onClose?.(), 4400);
    return () => {
      cancelAnimationFrame(enter);
      clearTimeout(hideAt);
      clearTimeout(removeAt);
    };
  }, [event, onClose]);

  if (!event) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center pointer-events-none">
      <div
        className={`mt-3 mx-3 w-[min(820px,94vw)] transition-all duration-500 ease-out
          ${show ? 'translate-y-0 opacity-100' : '-translate-y-[140%] opacity-0'}`}
      >
        <div className="celebrate-banner rounded-3xl border-2 border-accent-gold/70
          bg-gradient-to-r from-accent-blue/35 via-accent-purple/45 to-accent-gold/35
          backdrop-blur-md shadow-[0_20px_60px_-10px_rgba(245,179,1,0.55)]
          px-8 py-6 flex items-center gap-5">
          <div className="text-6xl drop-shadow-lg select-none">🎉</div>
          <div className="flex-1 min-w-0">
            <div className="text-3xl font-extrabold tracking-tight leading-tight
              bg-gradient-to-r from-accent-gold via-white to-accent-gold bg-clip-text text-transparent">
              {event.title}
            </div>
            {event.body && (
              <div className="text-base mt-1.5 opacity-95 truncate">{event.body}</div>
            )}
          </div>
          <div className="text-5xl drop-shadow-lg select-none">✨</div>
        </div>
      </div>
    </div>
  );
}
