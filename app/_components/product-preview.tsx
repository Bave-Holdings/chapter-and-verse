import Image from "next/image";
import styles from "../page.module.css";

function WavePattern({ className }: { className: string }) {
  return (
    <svg className={className} viewBox="0 0 520 260" fill="none" aria-hidden="true">
      {Array.from({ length: 14 }, (_, index) => (
        <path
          d={`M-20 ${52 + index * 9} C85 ${-25 + index * 8}, 178 ${20 + index * 5}, 252 ${84 + index * 4} S410 ${190 + index * 2}, 548 ${70 + index * 8}`}
          key={index}
        />
      ))}
    </svg>
  );
}

export function ProductPreview() {
  return <aside className={styles.visualPanel} aria-hidden="true">
    <WavePattern className={styles.dotPatternTop} />
    <WavePattern className={styles.dotPatternLeft} />
    <WavePattern className={styles.dotPatternBottom} />
    <div className={styles.productPreview}>
      <Image src="/product-preview.webp" alt="" width={770} height={752}
        sizes="(max-width: 900px) 0px, 52vw" className={styles.previewImage} />
    </div>
  </aside>;
}
