import Image from "next/image";
import Link from "next/link";

/** Home-screen top bar — Wondavu logo plus notification and group-chat shortcuts. */
export function AppTopBar() {
  return (
    <header className="flex items-center justify-between px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <Link href="/" aria-label="Wondavu home" className="flex items-center">
        <Image
          src="/wondavu-logo-v2.png"
          alt="Wondavu"
          width={240}
          height={240}
          priority
          className="h-24 w-auto"
        />
      </Link>

      <div className="flex items-center gap-2">
        <Link
          href="/notifications"
          aria-label="Notifications"
          className="relative flex h-11 w-11 items-center justify-center active:scale-95"
        >
          <span
            aria-hidden
            className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
          />
          <Image
            src="/icons/orange/bell.png"
            alt=""
            width={88}
            height={88}
            className="relative h-full w-full object-contain"
          />
        </Link>
        <Link
          href="/meet"
          aria-label="Group chats"
          className="relative flex h-11 w-11 items-center justify-center active:scale-95"
        >
          <span
            aria-hidden
            className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
          />
          <Image
            src="/icons/orange/group_join.png"
            alt=""
            width={88}
            height={88}
            className="relative h-full w-full object-contain"
          />
        </Link>
      </div>
    </header>
  );
}
