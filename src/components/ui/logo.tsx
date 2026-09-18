import Image from "next/image";

// The Day One mark. Its navy D turns light in dark mode; only one image
// shows at a time, so each carries the name for screen readers.
export default function Logo({
  className = "h-10 w-auto",
  priority = false,
}: {
  className?: string;
  priority?: boolean;
}) {
  return (
    <>
      <Image
        src="/logo.png"
        alt="Day One"
        width={285}
        height={360}
        priority={priority}
        className={`${className} dark:hidden`}
      />
      <Image
        src="/logo-dark.png"
        alt="Day One"
        width={285}
        height={360}
        priority={priority}
        className={`${className} hidden dark:block`}
      />
    </>
  );
}
