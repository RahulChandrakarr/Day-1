import Image from "next/image";
import sky from "../../../public/iccup-xNtwmcRP-gw-unsplash.jpg";

// The sky behind every page. It stays fixed while the glass scrolls over it.
// The photo is portrait (3:4), so on a screen narrower than that it fills the
// height and is 75vh wide; everywhere else it fills the width.
export default function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Image
        src={sky}
        alt=""
        fill
        placeholder="blur"
        loading="eager"
        fetchPriority="high"
        sizes="(max-aspect-ratio: 3/4) 75vh, 100vw"
        className="object-cover"
      />
      <div className="sky-wash absolute inset-0" />
    </div>
  );
}
