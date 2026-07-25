export default function KioskIdleScreen({
  onInteract,
}: { onInteract: () => void }) {
  return (
    <button
      type="button"
      className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-sm cursor-pointer w-full h-full"
      onClick={onInteract}
      aria-label="Chạm để bắt đầu"
      data-ocid="kiosk.idle_screen"
    >
      <div className="flex flex-col items-center gap-6 text-center px-8">
        <img
          src="/assets/logo-bunbohue65.png"
          alt="Bún Bò Huế 65"
          className="h-28 w-auto object-contain drop-shadow-2xl"
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
        <h1 className="text-4xl font-bold text-white drop-shadow-lg">
          Chào mừng đến Bún Bò Huế 65
        </h1>
        <p className="text-2xl text-white/80">Chạm để bắt đầu</p>
        <div className="mt-4 flex gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-2.5 w-2.5 animate-bounce rounded-full bg-white/60"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </div>
      </div>
    </button>
  );
}
