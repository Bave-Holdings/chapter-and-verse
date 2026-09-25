import Image from "next/image";

import styles from "../page.module.css";

function UserIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="7" r="2.5" />
      <path d="M6.5 18.5v-2.2c0-2.2 2.5-3.8 5.5-3.8s5.5 1.6 5.5 3.8v2.2c-3.7 1.4-7.3 1.4-11 0Z" />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 11 2-6h12l2 6-2 8H6l-2-8Z" />
      <path d="M8.5 15.5h7" />
    </svg>
  );
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 15V4m0 0L8.5 7.5M12 4l3.5 3.5" />
      <path d="M6.5 10.5H5.4A2.4 2.4 0 0 0 3 12.9v5.2a2.4 2.4 0 0 0 2.4 2.4h13.2a2.4 2.4 0 0 0 2.4-2.4v-5.2a2.4 2.4 0 0 0-2.4-2.4h-1.1" />
    </svg>
  );
}

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
  const navigation = ["Mortgage", "Investment", "Compliance", "HR"];

  return (
    <aside className={styles.visualPanel} aria-hidden="true">
      <WavePattern className={styles.dotPatternTop} />
      <WavePattern className={styles.dotPatternLeft} />
      <WavePattern className={styles.dotPatternBottom} />
      <div className={styles.productPreview}>
        <nav className={styles.previewSidebar}>
          <div className={styles.previewBrand}>
            <span className={styles.previewMark}>
              <Image
                src="/chapter-verse-mark.svg"
                alt=""
                width={74}
                height={76}
              />
            </span>
            <strong>Chapter &amp; Verse</strong>
            <small>&ldquo;Hey, quick question.&rdquo;</small>
            <em>AN INTELLENCE PRODUCT</em>
          </div>
          <p>KNOWLEDGE</p>
          <ul>
            {navigation.map((item, index) => (
              <li className={index === 0 ? styles.activeNav : undefined} key={item}>
                {index === 0 ? <HomeIcon /> : <UserIcon />}
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.previewMain}>
          <header className={styles.previewHeader}>
            <span>Knowledge Hub</span>
            <strong>Good afternoon, Syed</strong>
          </header>
          <div className={styles.previewBody}>
            <div className={styles.previewIntro}>
              <span>Chapter &amp; Verse</span>
              <strong>What do you need to check today?</strong>
              <p>Pick a category on the left, or jump straight to one of the pages most people ask about.</p>
            </div>
            <div className={styles.uploadGrid}>
              {Array.from({ length: 6 }, (_, index) => (
                <div className={styles.uploadCard} key={index}>
                  <span><UploadIcon /></span>
                  <small>Upload logo</small>
                </div>
              ))}
            </div>
            <div className={styles.previewComposer}>Write Here...</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
