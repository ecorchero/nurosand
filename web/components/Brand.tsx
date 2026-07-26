import Link from "next/link";

export default function Brand({ size = 26 }: { size?: number }) {
  const width = Math.round((520 / 154) * size);
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Nurosand home">
      {/* Plain img avoids next/image hydration mismatches on mobile Safari. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/nurosand-logo.png"
        alt="Nurosand"
        width={width}
        height={size}
        style={{ width, height: size }}
      />
    </Link>
  );
}
