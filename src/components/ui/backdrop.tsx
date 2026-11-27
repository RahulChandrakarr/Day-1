/* eslint-disable @next/next/no-img-element -- their own photo is served by /api/media to the signed-in person only, which the image optimizer can't fetch */
import Image from "next/image";
import sky from "../../../public/iccup-xNtwmcRP-gw-unsplash.jpg";
import { GRADIENTS, type BackgroundChoice } from "@/lib/backgrounds";

// The picture behind every page, chosen in Settings -> Appearance. It stays
// fixed while the glass scrolls over it. The sky photo is the default, and
// what shows if their own photo can't be loaded.
export default function Backdrop({
  choice = "sky",
  photoUrl = null,
}: {
  choice?: BackgroundChoice;
  photoUrl?: string | null;
}) {
  const gradient = GRADIENTS.find((g) => g.id === choice);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {choice === "upload" && photoUrl ? (
        <img src={photoUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
      ) : gradient ? (
        <div className="absolute inset-0" style={{ background: gradient.css }} />
      ) : (
        // The photo is portrait (3:4), so on a screen narrower than that it
        // fills the height and is 75vh wide; everywhere else it fills the width
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
      )}
      <div className="sky-wash absolute inset-0" />
    </div>
  );
}
