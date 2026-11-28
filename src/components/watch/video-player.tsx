import type { YtVideo } from "@/lib/media";

export default function VideoPlayer({ video }: { video: YtVideo }) {
  return (
    <section className="card overflow-hidden">
      <div className="aspect-video bg-ink">
        <iframe
          title={video.title}
          src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0`}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          className="h-full w-full border-0"
        />
      </div>
      <div className="px-4 py-3 sm:px-5">
        <h2 className="text-[17px] font-bold leading-snug tracking-[-0.015em]">{video.title}</h2>
        {video.channel && <p className="mt-0.5 text-sm text-paper/70">{video.channel}</p>}
      </div>
    </section>
  );
}
