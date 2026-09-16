/* eslint-disable @next/next/no-img-element -- signed Storage URLs change hourly */

// Profile photo, or the first letter of the name.
export default function Avatar({ url, name }: { url: string | null; name: string }) {
  if (!url) return <>{name.charAt(0).toUpperCase()}</>;
  return <img src={url} alt="" className="h-full w-full object-cover" />;
}
