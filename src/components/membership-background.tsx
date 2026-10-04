import Image from "next/image";

export function MembershipBackground({ priority = false }: { priority?: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden" aria-hidden="true">
      <div className="absolute inset-x-0" style={{ top: "-45%", height: "145%" }}>
        <Image
          src="/images/membership-stadium.jpg"
          alt=""
          fill
          priority={priority}
          sizes="100vw"
          className="object-cover object-bottom"
        />
      </div>
      <div className="absolute inset-0 bg-black/30" />
    </div>
  );
}
