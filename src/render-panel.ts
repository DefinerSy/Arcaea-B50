import characterAssets from "./data/characters.json";
import { formatRating, getBest50, grade, potentialTier } from "./rating";
import type { Archive, Score } from "./archive";

const asset = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );
const diamond =
  '<svg viewBox="0 0 32 40" fill="none" aria-hidden="true"><path d="M16 1 31 20 16 39 1 20Z" stroke="currentColor"/><path d="m16 7 10 13-10 13L6 20Z" fill="currentColor"/><path d="m16 11 3 9-3 9-3-9Z" fill="var(--bg)"/></svg>';
const sun =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg>';
const moon =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/></svg>';

function card(entry: Score & { playRating: number }, i: number) {
  const pm = entry.far === 0 && entry.lost === 0;
  const fr = !pm && entry.lost === 0;
  return `<article class="score-card compact-card ${escape(entry.difficulty.toLowerCase())} ${i < 10 ? "top-ten" : ""}" aria-label="第 ${i + 1} 名 ${escape(entry.title)} ${entry.difficulty}">
    <div class="record-jacket">
      <img class="jacket" src="${asset(entry.jacket)}" alt="${escape(entry.title)} 曲绘" width="300" height="300" loading="${i < 10 ? "eager" : "lazy"}" decoding="async" />
      <span class="rank"><span>#</span>${String(i + 1).padStart(2, "0")}</span>
    </div>
    <div class="record-details">
      <h3 title="${escape(entry.title)} · ${escape(entry.artist)}">${escape(entry.title)}</h3>
      <div class="score-line"><strong class="score">${entry.score.toLocaleString("en-US").replaceAll(",", "'")}</strong></div>
      <div class="record-rating"><span class="record-constant" aria-label="定数 ${entry.constant.toFixed(1)}" title="${escape(entry.difficulty)} ${escape(entry.level)} · 定数 ${entry.constant.toFixed(1)}"><b>${entry.constant.toFixed(1)}</b></span><span class="record-ptt"><span>PTT</span><b>${formatRating(entry.playRating)}</b></span></div>
      <div class="record-judgements"><span title="Pure ${entry.pure}，其中大 Pure ${entry.shiny}">P <b>${entry.pure}</b><small>+${entry.shiny}</small></span><span>F <b>${entry.far}</b></span><span>L <b>${entry.lost}</b></span></div>
    </div>
    <div class="record-footer"><span class="clear ${pm ? "pm" : fr ? "fr" : ""}">${pm ? "PURE MEMORY" : fr ? "FULL RECALL" : "TRACK COMPLETE"}</span><span class="record-grade">${grade(entry.score)}</span></div>
  </article>`;
}

export function renderArchiveMarkup(demo: Archive): string {
  const character = demo.player.character;
  const images = characterAssets as Record<string, string>;
  const characterPath = character
    ? (images[`${character.id}${character.awakened ? "u" : ""}`] ??
      images[String(character.id)])
    : undefined;
  const portrait = characterPath ?? demo.player.avatar;
  const characterBackground =
    demo.player.characterImage ??
    characterPath ??
    (demo.player.avatar !== "assets/jacket-fallback.svg"
      ? demo.player.avatar
      : undefined);
  const imageSource = (path: string) =>
    path.startsWith("data:image/") ? path : asset(path);
  const { best, b50, b10, max } = getBest50(demo.scores);
  const pmCount = best.filter(
    (entry) => entry.far === 0 && entry.lost === 0,
  ).length;
  const frCount = best.filter(
    (entry) => entry.far > 0 && entry.lost === 0,
  ).length;
  const exCount = best.filter((entry) => entry.score >= 9_900_000).length;

  const markup = `
  <a class="skip-link" href="#best50">跳到 Best 50 成绩</a>
  <div class="ambient" aria-hidden="true"></div>
  <header class="site-header">
    <a class="brand" href="#" aria-label="Arcaea 记忆档案首页">${diamond}<span>arcaea<small>MEMORY ARCHIVE</small></span></a>
    <div class="header-right"><span class="archive-label">个人成绩档案 <span>/</span> BEST 50</span><div class="theme-switch" role="group" aria-label="面板主题"><button data-theme="light" aria-label="光：浅色主题" aria-pressed="false">${sun}<span>光</span></button><button data-theme="dark" aria-label="对立：深色主题" aria-pressed="true">${moon}<span>对立</span></button></div></div>
  </header>
  <main class="page-shell">
    <section class="profile-panel identity-panel" aria-labelledby="player-heading">
      ${characterBackground ? `<img class="profile-character" src="${escape(imageSource(characterBackground))}" alt="" aria-hidden="true" />` : ""}
      <div class="player identity-player"><div class="avatar-frame"><img src="${asset(portrait)}" alt="玩家头像" width="76" height="76" /></div><div class="player-info"><h1 id="player-heading" class="player-name">${escape(demo.player.name)}</h1>${demo.player.id ? `<p>ID <span>${escape(demo.player.id)}</span></p>` : ""}</div></div>
      <div class="profile-stats"><div><span>BEST 50</span><strong>${formatRating(b50)}</strong></div><div><span>BEST 10</span><strong>${formatRating(b10)}</strong></div><div class="max-stat"><span>MAX POTENTIAL</span><strong>${formatRating(max)}</strong></div></div>
      <div class="potential-showcase" aria-label="POTENTIAL ${formatRating(max, 2)}" title="等级徽章按 Max Potential 展示"><span class="potential-heading">POTENTIAL</span><div class="potential-badge" data-tier="${potentialTier(max)}"><img class="potential-frame" src="${asset(`assets/rating/rating_${potentialTier(max)}.png`)}" width="136" height="136" alt="" aria-hidden="true" /><strong class="potential-value">${formatRating(max, 2)}</strong></div></div>
    </section>
    <section class="records-section" id="best50" aria-labelledby="records-heading">
      <div class="section-heading"><div><div class="eyebrow">YOUR BEST PERFORMANCES</div><h2 id="records-heading">Best <span>50</span><i></i><small>最佳成绩</small></h2></div><div class="record-meta">${demo.source?.skipped ? '<span class="record-status"><i></i> 部分成绩</span>' : ""}<span class="updated">记录于 ${escape(demo.recordedAt.replaceAll("-", "."))}</span></div></div>
      <div class="record-bar"><div class="record-count"><span class="tiny-diamond"></span><strong>${best.length}</strong> 枚记忆碎片 <span class="bar-divider"></span><span class="sort-label">按单曲潜力值从高到低排列</span></div><div class="record-summary"><span><i class="pm-dot"></i> PM <b>${pmCount}</b></span><span><i class="fr-dot"></i> FR <b>${frCount}</b></span><span>EX+ <b>${exCount}</b></span></div></div>
      <div class="score-grid">${best.map(card).join("")}</div>
      <div class="end-mark" aria-hidden="true"><span></span>${diamond}<span></span></div>
      <div class="end-copy">THE JOURNEY CONTINUES<span>下一枚闪耀的碎片，等待着你。</span></div>
    </section>
    <aside class="data-note" data-export-exclude><span>◇</span><p>B50、B10 与 Max 根据成绩实时计算。${best.length < 50 ? ` 当前仅 ${best.length} 首，缺失位置按零计入。` : ""}<br>PM 为 Pure Memory；FR 为 Full Recall（不含 PM）；EX+ 按分数统计，可能与前两项重叠。${demo.source?.version ? `<br>定数版本：${escape(demo.source.version)}` : ""}${demo.source?.warnings.length ? `<br>${demo.source.warnings.map(escape).join("<br>")}` : ""}</p></aside>
    <div class="image-credit" data-export-exclude>ARCAEA · BEST 50 MEMORY ARCHIVE <span>${escape(demo.recordedAt)}</span></div>
  </main>
  <footer><a class="footer-brand" href="#">arcaea <span>·</span> memory archive</a><p>Inspired by Arcaea <span>／</span> <a href="https://github.com/SmartRTE/SmartRTE.github.io" target="_blank" rel="noopener noreferrer">Reference: SmartRTE ↗</a></p><span class="unofficial">UNOFFICIAL FAN PROJECT</span></footer>`;

  return markup;
}
