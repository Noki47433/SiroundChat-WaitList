import Image from "next/image";
import Link from "next/link";

import styles from "@/components/templates/hously/hously.module.css";

type HouslyWordmarkProps = {
  brand: string;
  logoUrl?: string | null;
  href?: string;
};

export function HouslyWordmark({ brand, logoUrl, href = "#hero" }: HouslyWordmarkProps) {
  return (
    <Link href={href} className={`${styles.wordmark} inline-flex items-center gap-3 text-xl font-medium uppercase md:text-2xl`}>
      {logoUrl ? (
        <Image
          src={logoUrl}
          alt={`${brand} logo`}
          width={40}
          height={40}
          unoptimized
          className="h-9 w-9 object-contain md:h-10 md:w-10"
        />
      ) : null}
      <span>{brand}</span>
    </Link>
  );
}
