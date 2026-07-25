import Image from "next/image";
import Link from "next/link";

export default function Brand({ size = 26 }: { size?: number }) {
  const width = Math.round((520 / 154) * size);
  return (
    <Link href="/" className="inline-flex items-center" aria-label="Nurosand home">
      <Image
        src="/nurosand-logo.png"
        alt="Nurosand"
        width={width}
        height={size}
        priority
      />
    </Link>
  );
}
