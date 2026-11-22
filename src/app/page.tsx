"use client";

import React, { useEffect, useState } from "react";

type CategoryType = "신제품" | "수집 가이드";
type SortType = "latest" | "code" | "release-desc" | "release-asc" | "title";

interface ArchiveItem {
  id: string;
  code: string;
  category: CategoryType;
  series: string;
  title: string;
  maker: string;
  scale: string;
  releaseDate: string;
  price: string;
  summary: string;
  content: string;
  imageUrl?: string;
  images?: string[];
  hidden?: boolean;
}

interface SearchImageCandidate {
  url: string;
  thumbnail: string;
  title: string;
}

interface KujiLiveItem {
  slug: string;
  title: string;
  series: string;
  releaseDate: string;
  price: string;
  imageUrl: string;
  sourceUrl: string;
  isUpcoming: boolean;
}

const CURRENT_YEAR = 2026;
import seedData from "../data/archive-seed.json";
const STORAGE_KEY = "figu_archive_items_v1";

function extractYear(releaseDate: string): string | null {
  const match = releaseDate.match(/(20\d{2})/);
  return match ? match[1] : null;
}

function parseReleaseSortValue(releaseDate: string): number {
  const match = releaseDate.match(/(20\d{2})[.\-/년\s]*(\d{1,2})?/);
  if (!match) return 0;
  return Number(match[1]) * 100 + (match[2] ? Number(match[2]) : 0);
}

function getItemImages(item: { images?: string[]; imageUrl?: string }): string[] {
  if (Array.isArray(item.images) && item.images.length > 0) {
    return item.images.filter((url) => url && url.trim() !== "");
  }
  if (item.imageUrl && item.imageUrl.trim() !== "") {
    return [item.imageUrl.trim()];
  }
  return [];
}

function getDisplayImageUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim();
  if (!trimmed) return "";
  if (
    trimmed.startsWith("/") ||
    trimmed.startsWith("data:") ||
    trimmed.includes("1kuji.com") ||
    trimmed.includes("bpnavi.jp") ||
    trimmed.includes("bandaispirits.co.jp") ||
    trimmed.includes("duckduckgo.com") ||
    trimmed.includes("bing.net")
  ) {
    return trimmed;
  }
  return `/api/image-proxy?url=${encodeURIComponent(trimmed)}`;
}

function detectIsIchibanKuji(title: string, maker: string, price: string): boolean {
  return /이치방쿠지|제일복권|ichiban\s*kuji|一番くじ|마스터라이즈|masterlise/i.test(
    `${title} ${maker} ${price}`
  );
}

function is1kujiPageUrl(url: string): boolean {
  const trimmed = url.trim().toLowerCase();
  return (
    trimmed.includes("1kuji.com") &&
    !/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(trimmed)
  );
}

const KEYWORD_EN_MAP: [RegExp, string][] = [
  [/굿스마일\s*컴퍼니|굿스마일/g, "Good Smile Company"],
  [/반다이\s*스피리츠|반다이/g, "Bandai Spirits"],
  [/이치방쿠지|제일복권/g, "Ichiban Kuji"],
  [/코토부키야/g, "Kotobukiya"],
  [/메가하우스/g, "Megahouse"],
  [/맥스팩토리/g, "Max Factory"],
  [/알터/g, "Alter"],
  [/후류/g, "FuRyu"],
  [/타이토/g, "Taito"],
  [/봇치더락!?|봇치\s*더\s*록!?/g, "Bocchi the Rock"],
  [/에반게리온/g, "Evangelion"],
  [/드래곤볼/g, "Dragon Ball"],
  [/원피스/g, "One Piece"],
  [/귀멸의\s*칼날/g, "Demon Slayer"],
  [/주술회전/g, "Jujutsu Kaisen"],
  [/체인소맨/g, "Chainsaw Man"],
  [/블루\s*아카이브/g, "Blue Archive"],
  [/원신/g, "Genshin Impact"],
  [/마스터라이즈/g, "MASTERLISE"],
  [/라스트원상|라스트원/g, "ラストワン賞"],
  [/([A-G])\s*상/gi, "$1賞"],
  [/볼륨\s*(\d+)/gi, "VOLUME $1"],
  [/피규어/g, "figure"],
];

const KUJI_JP_MAP: [RegExp, string][] = [
  [/이치방쿠지|제일복권/g, "一番くじ"],
  [/에반게리온/g, "エヴァンゲリオン"],
  [/드래곤볼/g, "ドラゴンボール"],
  [/원피스/g, "ワンピース"],
  [/귀멸의\s*칼날/g, "鬼滅の刃"],
  [/주술회전/g, "呪術廻戦"],
  [/체인소맨/g, "チェンソーマン"],
  [/나의\s*히어로\s*아카데미아|나히아/g, "僕のヒーローアカデミア"],
  [/헌터헌터|헌터x헌터/g, "HUNTER×HUNTER"],
  [/죠죠/g, "ジョジョ"],
  [/봇치더락!?|봇치\s*더\s*록!?/g, "ぼっち・ざ・ろっく！"],
  [/블루\s*아카이브/g, "ブルーアーカイブ"],
  [/마스터라이즈/g, "MASTERLISE"],
  [/라스트원상|라스트원/g, "ラストワン賞"],
  [/([A-G])\s*상/gi, "$1賞"],
  [/볼륨\s*(\d+)/gi, "VOLUME $1"],
  [/피규어/g, "フィギュア"],
];

function translateKeywordsToEn(text: string): string {
  let result = text;
  for (const [pattern, replacement] of KEYWORD_EN_MAP) {
    result = result.replace(pattern, replacement);
  }
  return result.replace(/\s+/g, " ").trim();
}

function buildSmartFigureQuery(
  title: string,
  maker: string,
  scale: string,
  isKuji: boolean
): string {
  const baseTitle = title.replace(/\([^)]*\)/g, " ").replace(/\[[^\]]*\]/g, " ");
  if (isKuji) {
    let jpTitle = baseTitle;
    for (const [pattern, replacement] of KUJI_JP_MAP) {
      jpTitle = jpTitle.replace(pattern, replacement);
    }
    const cleaned = jpTitle
      .replace(/반다이\s*스피리츠|반다이|Bandai\s*Spirits/gi, "")
      .replace(/\s+/g, " ")
      .trim();
    return cleaned.includes("一番くじ") ? cleaned : `一番くじ ${cleaned}`;
  }

  const cleanTitle = translateKeywordsToEn(baseTitle);
  const cleanMaker = translateKeywordsToEn(maker);
  const isPrizeOrKuji = /ichiban kuji|banpresto|furyu|taito|sega|논스케일/i.test(
    `${cleanTitle} ${cleanMaker} ${scale}`
  );
  const scaleMatch = scale.match(/1\/\d+/);
  const scaleToken = !isPrizeOrKuji && scaleMatch ? scaleMatch[0] : "";
  const rawTokens = `${cleanTitle} ${cleanMaker} ${scaleToken} figure`.split(/\s+/);
  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const token of rawTokens) {
    const lower = token.toLowerCase();
    if (lower && !seen.has(lower)) {
      seen.add(lower);
      deduped.push(token);
    }
  }
  return deduped.join(" ");
}

const INITIAL_DATA: ArchiveItem[] = [
  {
    id: "1",
    code: "FIG-2026-001",
    category: "신제품",
    series: "신세기 에반게리온",
    title: "에반게리온 초호기 (신극장판 Ver.)",
    maker: "굿스마일 컴퍼니",
    scale: "1/7 스케일",
    releaseDate: "2026.12 예정",
    price: "24,800엔",
    summary: "유광·무광 투톤 마감과 클리어 파츠를 적용한 하이엔드 스태츄 라인업.",
    content:
      "초호기 특유의 보라색·형광 연두색 대비를 유광과 반광 도료로 분리 도색한 신작 스태츄입니다.\n\n눈과 코어 부위에는 클리어 파츠가 적용되어 상단 조명을 비추었을 때 입체감이 살아납니다.",
    images: [],
  },
  {
    id: "5",
    code: "FIG-2027-003",
    category: "신제품",
    series: "신세기 에반게리온",
    title: "이카리 신지 & 카오루 피아노 듀엣 디오라마",
    maker: "코토부키야",
    scale: "1/7 스케일",
    releaseDate: "2027.02 예정",
    price: "31,000엔",
    summary: "그랜드 피아노 건반과 악보까지 세밀하게 구현한 비네트형 완성품 피규어.",
    content:
      "극중 연탄 장면을 모티브로 제작된 2인 세트 디오라마 피규어입니다. 그랜드 피아노 외장의 유광 블랙 코팅과 악보대의 오선지 인쇄까지 정교하게 마감되었습니다.",
    images: [],
  },
];

const EMPTY_FORM: {
  category: CategoryType;
  series: string;
  title: string;
  maker: string;
  scale: string;
  releaseDate: string;
  price: string;
  summary: string;
  content: string;
  images: string[];
} = {
  category: "신제품",
  series: "",
  title: "",
  maker: "",
  scale: "1/7 스케일",
  releaseDate: "2027.03 예정",
  price: "",
  summary: "",
  content: "",
  images: [],
};

async function buildAutoPublishedArticle(
  kuji: KujiLiveItem,
  codeNumber: number
): Promise<ArchiveItem> {
  let images: string[] = kuji.imageUrl ? [kuji.imageUrl] : [];
  let releaseText = kuji.releaseDate;
  let priceText = kuji.price;
  let storeText = "";
  let description = "";
  let prizes: string[] = [];

  try {
    const res = await fetch(`/api/kuji-detail?url=${encodeURIComponent(kuji.sourceUrl)}`);
    if (res.ok) {
      const detail = await res.json();
      if (Array.isArray(detail.images) && detail.images.length > 0) {
        const getImgKey = (u: string) =>
          u.split("?")[0].split("/").pop()?.replace(/(_s|_m|_l|_thumb|thumb_)/gi, "").toLowerCase() || u;
        const seenKeys = new Set<string>();
        images = detail.images.filter((u: string) => {
          const k = getImgKey(u);
          if (seenKeys.has(k)) return false;
          seenKeys.add(k);
          return true;
        });
      }
      if (detail.releaseText) releaseText = detail.releaseText;
      if (detail.priceText) priceText = detail.priceText;
      if (detail.storeText) storeText = detail.storeText;
      if (detail.description) description = detail.description;
      if (Array.isArray(detail.prizes)) prizes = detail.prizes;
    }
  } catch {
    // 기본 데이터 유지
  }

  // 타이틀 앞부분의 매장/온라인 판매 및 발매일 안내 잡문구 제거 후 순수 쿠지 타이틀 추출
  const cleanRawTitle = (() => {
    const raw = kuji.title.trim();
    const kujiIdx = raw.indexOf("一番くじ");
    if (kujiIdx > 0) return raw.slice(kujiIdx).trim();
    return raw
      .replace(/^(?:店頭販売|オンライン販売|ダブルチャンスキャンペーン|メーカー希望小売価格)\s*/g, "")
      .replace(/^\d{4}年\d{1,2}月(?:\d{1,2}日\([^)]+\)|[上中下]旬)?(?:より)?(?:順次)?発売予定\s*/g, "")
      .replace(/^(?:店頭販売|オンライン販売)\s*/g, "")
      .trim() || raw;
  })();

  // 일본어 제목 · 본문 · 경품 라인업 일괄 한국어 번역
  let koTitle = cleanRawTitle;
  let koReleaseText = releaseText;
  let koPriceText = priceText;
  let koStoreText = storeText;
  let koDescription = description;
  let koPrizes = [...prizes];

  try {
    const textsToTranslate = [
      cleanRawTitle,
      releaseText,
      priceText,
      storeText,
      description,
      ...prizes,
    ];
    const tRes = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: textsToTranslate }),
    });
    if (tRes.ok) {
      const tData = await tRes.json();
      if (Array.isArray(tData.translations) && tData.translations.length >= 5) {
        koTitle = tData.translations[0] || cleanRawTitle;
        koReleaseText = tData.translations[1] || releaseText;
        koPriceText = tData.translations[2] || priceText;
        koStoreText = tData.translations[3] || storeText;
        koDescription = tData.translations[4] || description;
        if (prizes.length > 0) {
          koPrizes = tData.translations.slice(5, 5 + prizes.length);
        }
      }
    }
  } catch {
    // 번역 실패 시 원문 유지
  }

  // 쿠지 타이틀: 한국어 번역 + 일본어 원문 병기
  const bilingualTitle =
    koTitle && koTitle.trim() !== cleanRawTitle
      ? `${koTitle.trim()} (${cleanRawTitle})`
      : cleanRawTitle;

  const parsedYear = extractYear(kuji.releaseDate) || "2027";
  const seqStr = String(codeNumber).padStart(3, "0");
  const topPrizesPreview =
    koPrizes.length > 0 ? koPrizes.slice(0, 3).join(" / ") : `${kuji.series} 공식 신작 라인업`;

  const contentLines: string[] = [
    `■ 시리즈 개요`,
    `반다이 스피리츠(BANDAI SPIRITS)의 '이치방쿠지(一番くじ)' 공식 라인업으로 공개된 「${bilingualTitle}」 신작 정보입니다.`,
    ``,
    `■ 발매 및 판매 정보`,
    `• 발매 일정: ${koReleaseText}`,
    `• 권장 가격: ${koPriceText}`,
  ];
  if (koStoreText) contentLines.push(`• 주요 취급점: ${koStoreText}`);
  contentLines.push(`• 공식 페이지: ${kuji.sourceUrl}`);
  if (koDescription) contentLines.push(``, `■ 공식 소개`, koDescription);
  if (koPrizes.length > 0) {
    contentLines.push(``, `■ 주요 경품 라인업 (${koPrizes.length}종 확인)`);
    koPrizes.forEach((p) => contentLines.push(`• ${p}`));
  }

  return {
    id: `auto-post-${kuji.slug}-${Date.now()}-${codeNumber}`,
    code: `FIG-${parsedYear}-${seqStr}`,
    category: "신제품",
    series: kuji.series,
    title: bilingualTitle,
    maker: "반다이 스피리츠 (이치방쿠지)",
    scale: koPrizes.length > 0 ? `경품 ${koPrizes.length}종 라인업` : "경품 라인업 (논스케일)",
    releaseDate: kuji.releaseDate,
    price: kuji.price,
    summary: `[이치방쿠지 신작 리포트] ${kuji.releaseDate} 발매 예정 · ${topPrizesPreview} 등 총 ${images.length}컷 피규어 화보 수록.`,
    content: contentLines.join("\n"),
    images,
    imageUrl: images[0] || "",
  };
}

export default function Home() {
  const DEFAULT_ARCHIVE: ArchiveItem[] = Array.isArray(seedData) && seedData.length > 0 ? (seedData as ArchiveItem[]) : INITIAL_DATA;
  const [items, setItems] = useState<ArchiveItem[]>(DEFAULT_ARCHIVE);
  const [isLoaded, setIsLoaded] = useState(false); const [isAdmin, setIsAdmin] = useState(false); const [adminSessionPassword, setAdminSessionPassword] = useState("");
  const [selectedSeries, setSelectedSeries] = useState("전체");
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [selectedYear, setSelectedYear] = useState("전체 연도");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortType>("latest");

  const [isAutoPublishing, setIsAutoPublishing] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [selectedManageIds, setSelectedManageIds] = useState<string[]>([]);
  const [manageSearchQuery, setManageSearchQuery] = useState("");
  const [isRefreshingPosts, setIsRefreshingPosts] = useState(false);
  const [refreshProgressText, setRefreshProgressText] = useState<string | null>(null);

  const handleRefreshArchiveItems = async (targetIds: string[]) => {
    if (targetIds.length === 0 || isRefreshingPosts) return;
    setIsRefreshingPosts(true);
    setRefreshProgressText("⏳ 1kuji.com 공식 최신 데이터를 조회하는 중...");
    try {
      let liveCatalog: KujiLiveItem[] = [...liveKujiResults];
      if (liveCatalog.length === 0) {
        const res = await fetch("/api/kuji-search?q=");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.items)) liveCatalog = data.items;
        }
      }

      const targets = items.filter((it) => targetIds.includes(it.id));
      const updatedMap = new Map<string, ArchiveItem>();
      let skippedCount = 0;

      for (let i = 0; i < targets.length; i++) {
        const oldItem = targets[i];
        setRefreshProgressText(`🔄 최신 데이터 동기화 중 (${i + 1}/${targets.length}) : ${oldItem.title}`);

        const urlMatch = `${oldItem.content}\n${oldItem.summary}`.match(/https?:\/\/[^\s)>"']*1kuji\.com[^\s)>"']*/i);
        const rawUrl = urlMatch ? urlMatch[0] : "";

        const jpMatch = oldItem.title.match(/\((一番くじ[^)]+)\)/);
        const pureJp = jpMatch ? jpMatch[1].trim().toLowerCase() : "";

        let matchedKuji = liveCatalog.find((k) => {
          if (rawUrl && k.sourceUrl && k.sourceUrl.trim().toLowerCase() === rawUrl.toLowerCase()) return true;
          if (pureJp && k.title.toLowerCase().includes(pureJp)) return true;
          return false;
        });

        if (!matchedKuji && rawUrl) {
          matchedKuji = {
            slug: rawUrl.split("/").filter(Boolean).pop() || oldItem.id,
            title: jpMatch ? jpMatch[1].trim() : oldItem.title,
            series: oldItem.series,
            releaseDate: oldItem.releaseDate,
            price: oldItem.price,
            imageUrl: oldItem.imageUrl || (oldItem.images && oldItem.images[0]) || "",
            sourceUrl: rawUrl,
            isUpcoming: true,
          };
        }

        if (!matchedKuji) {
          skippedCount++;
          continue;
        }

        const fresh = await buildAutoPublishedArticle(matchedKuji, i + 1);
        updatedMap.set(oldItem.id, {
          ...fresh,
          id: oldItem.id,
          code: oldItem.code,
          hidden: oldItem.hidden,
        });
      }

      if (updatedMap.size > 0) {
        setItems((prev) => prev.map((it) => updatedMap.get(it.id) || it));
      }

      setRefreshProgressText(
        `✅ ${updatedMap.size}건 최신 상태로 갱신 완료!` +
          (skippedCount > 0 ? ` (수동/미연동 ${skippedCount}건 제외)` : "")
      );
    } catch {
      setRefreshProgressText("⚠️ 최신 상태 갱신 중 오류가 발생했습니다.");
    } finally {
      setIsRefreshingPosts(false);
    }
  };
  const [publishProgressText, setPublishProgressText] = useState<string | null>(null);

  const [isLiveSearchingKuji, setIsLiveSearchingKuji] = useState(false);
  const [liveKujiResults, setLiveKujiResults] = useState<KujiLiveItem[]>([]);
  const [liveKujiPage, setLiveKujiPage] = useState(0);
  const [liveKujiLabel, setLiveKujiLabel] = useState<string | null>(null);
  const [liveKujiError, setLiveKujiError] = useState<string | null>(null);
  const [importingSlug, setImportingSlug] = useState<string | null>(null);

  const [viewingItem, setViewingItem] = useState<ArchiveItem | null>(null);
  const [activeSlideIdx, setActiveSlideIdx] = useState(0);

  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [manualUrlInput, setManualUrlInput] = useState("");
  const [thumbFallbackMap, setThumbFallbackMap] = useState<Record<string, string>>({});

  const [imageSearchKeyword, setImageSearchKeyword] = useState("");
  const [imageCandidates, setImageCandidates] = useState<SearchImageCandidate[]>([]);
  const [rejectedImageUrls, setRejectedImageUrls] = useState<string[]>([]);
  const [isSearchingImages, setIsSearchingImages] = useState(false);
  const [isExtractingKujiPage, setIsExtractingKujiPage] = useState(false);
  const [imageSearchError, setImageSearchError] = useState<string | null>(null);
  const [candidateSourceLabel, setCandidateSourceLabel] = useState("MULTI-SELECT CANDIDATES");

  const isKujiProduct = detectIsIchibanKuji(formData.title, formData.maker, formData.price);
  const inputLooksLikeKujiPage = is1kujiPageUrl(manualUrlInput);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch("/api/archive", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          if (active && Array.isArray(data.items) && data.items.length > 0) {
            setItems(data.items);
          }
        }
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setIsLoaded(true);
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!isLoaded || !isAdmin) return;
    fetch("/api/archive", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: adminSessionPassword || (typeof window !== "undefined" ? sessionStorage.getItem("figu_admin_pw") || "" : ""), items }),
    }).catch((e) => console.error(e));
  }, [items, isLoaded, isAdmin, adminSessionPassword]);

  useEffect(() => {
    setActiveSlideIdx(0);
  }, [viewingItem?.id]);

  const handleLiveSearchKuji = async (customKeyword?: string) => {
    const q = (customKeyword !== undefined ? customKeyword : searchQuery).trim();
    setIsLiveSearchingKuji(true);
    setLiveKujiError(null);
    try {
      const res = await fetch(`/api/kuji-search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      if (!res.ok) {
        setLiveKujiError(data.error || "1kuji.com 최신 정보를 가져오지 못했습니다.");
        setLiveKujiResults([]);
        return;
      }
      const list: KujiLiveItem[] = Array.isArray(data.items) ? data.items : [];
      setLiveKujiResults(list);
      setLiveKujiLabel(data.query || (q || "2026~2027 최신 전체"));
      if (list.length === 0) setLiveKujiError("일치하는 최신 이치방쿠지 라인업이 없습니다.");
    } catch {
      setLiveKujiError("1kuji.com 서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setIsLiveSearchingKuji(false);
    }
  };

  const handleAutoPublishSingle = async (kuji: KujiLiveItem) => {
    setImportingSlug(kuji.slug);
    try {
      const newArticle = await buildAutoPublishedArticle(kuji, items.length + 1);
      setItems((prev) => [newArticle, ...prev]);
      setViewingItem(newArticle);
    } finally {
      setImportingSlug(null);
    }
  };

  const handleBatchAutoPublish = async (sourceCandidates?: KujiLiveItem[]) => {
    setIsAutoPublishing(true);
    setPublishProgressText("⏳ 1kuji.com 최신 신작 목록을 조회하는 중...");
    try {
      let targetList: KujiLiveItem[] = [];
      if (sourceCandidates && sourceCandidates.length > 0) {
        targetList = [...sourceCandidates];
      } else {
        const res = await fetch("/api/kuji-search?q=");
        const data = await res.json();
        if (!res.ok || !Array.isArray(data.items)) {
          setPublishProgressText("⚠️ 최신 이치방쿠지 목록을 불러오지 못했습니다.");
          return;
        }
        targetList = data.items as KujiLiveItem[];
      }

      const existingBlob = items
        .map((it) => `${it.title} ${it.summary} ${it.content}`.toLowerCase())
        .join("\n");

      const isAlreadyPublished = (k: KujiLiveItem) => {
        const raw = k.title.trim();
        const kujiIdx = raw.indexOf("一番くじ");
        const pureJp = (kujiIdx >= 0 ? raw.slice(kujiIdx) : raw).trim().toLowerCase();
        const srcUrl = (k.sourceUrl || "").trim().toLowerCase();
        if (pureJp && existingBlob.includes(pureJp)) return true;
        if (srcUrl && existingBlob.includes(srcUrl)) return true;
        return false;
      };

      const uncollected = targetList.filter((k) => !isAlreadyPublished(k));

      if (uncollected.length === 0) {
        setPublishProgressText(`✅ 조회된 ${(targetList?.length ?? 0)}건은 이미 모두 발행되어 있습니다.`);
        return;
      }

      const batch = uncollected.slice(0, 12);
      const createdArticles: ArchiveItem[] = [];
      for (let i = 0; i < batch.length; i++) {
        setPublishProgressText(
          `✍️ 피규어 선별 & 게시물 작성 중 (${i + 1}/${batch.length}) : ${batch[i].title}`
        );
        const article = await buildAutoPublishedArticle(
          batch[i],
          items.length + createdArticles.length + 1
        );
        createdArticles.push(article);
      }

      setItems((prev) => [...createdArticles, ...prev]);
      setSelectedCategory("신제품");
      setPublishProgressText(
        `🎉 최신 이치방쿠지 ${createdArticles.length}건이 피규어 전용 화보 포함 게시물로 자동 발행되었습니다!`
      );
    } catch {
      setPublishProgressText("⚠️ 자동 게시물 생성 중 오류가 발생했습니다.");
    } finally {
      setIsAutoPublishing(false);
    }
  };

  const seriesList = ["전체", ...Array.from(new Set(items.map((item) => item.series)))];
  const extractedYears = Array.from(
    new Set(
      items.map((item) => extractYear(item.releaseDate)).filter((y): y is string => Boolean(y))
    )
  ).sort((a, b) => Number(a) - Number(b));
  const yearFilterList = ["전체 연도", ...extractedYears];
  const nextYearPlusCount = items.filter((item) => {
    const y = extractYear(item.releaseDate);
    return y !== null && Number(y) > CURRENT_YEAR;
  }).length;

  const filteredItems = items
    .filter((item) => {
      if (item.hidden) return false;
      const matchSeries = selectedSeries === "전체" || item.series === selectedSeries;
      const matchCategory = selectedCategory === "전체" || item.category === selectedCategory;
      const matchYear =
        selectedYear === "전체 연도" || extractYear(item.releaseDate) === selectedYear;
      const kw = searchQuery.trim().toLowerCase();
      const matchSearch =
        kw === "" ||
        item.title.toLowerCase().includes(kw) ||
        item.series.toLowerCase().includes(kw) ||
        item.maker.toLowerCase().includes(kw) ||
        item.code.toLowerCase().includes(kw) ||
        item.releaseDate.toLowerCase().includes(kw) ||
        item.summary.toLowerCase().includes(kw);
      return matchSeries && matchCategory && matchYear && matchSearch;
    })
    .sort((a, b) => {
      if (sortBy === "code") return a.code.localeCompare(b.code);
      if (sortBy === "release-desc")
        return parseReleaseSortValue(b.releaseDate) - parseReleaseSortValue(a.releaseDate);
      if (sortBy === "release-asc")
        return parseReleaseSortValue(a.releaseDate) - parseReleaseSortValue(b.releaseDate);
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      return 0;
    });

    
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState("");
  const [adminAuthError, setAdminAuthError] = useState("");
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false);
  const [logoClickState, setLogoClickState] = useState({ count: 0, lastAt: 0 });

  useEffect(() => {
    fetch("/api/admin/auth", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { isAdmin: false }))
      .then((data) => setIsAdmin(Boolean(data.isAdmin)))
      .catch(() => setIsAdmin(false));
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "a") {
        e.preventDefault();
        if (!isAdmin) {
          setAdminPasswordInput("");
          setAdminAuthError("");
          setIsAdminModalOpen(true);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isAdmin]);

  const handleSecretLogoClick = () => {
    if (isAdmin) return;
    const now = Date.now();
    const nextCount = now - logoClickState.lastAt <= 1500 ? logoClickState.count + 1 : 1;
    if (nextCount >= 5) {
      setLogoClickState({ count: 0, lastAt: 0 });
      setAdminPasswordInput("");
      setAdminAuthError("");
      setIsAdminModalOpen(true);
    } else {
      setLogoClickState({ count: nextCount, lastAt: now });
    }
  };

  const handleAdminLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminPasswordInput.trim() || isAuthSubmitting) return;
    setIsAuthSubmitting(true);
    setAdminAuthError("");
    try {
      const res = await fetch("/api/admin/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPasswordInput }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setIsAdmin(true); setAdminSessionPassword(adminPasswordInput); try { sessionStorage.setItem("figu_admin_pw", adminPasswordInput); } catch {}
        setIsAdminModalOpen(false);
        setAdminPasswordInput("");
      } else {
        setAdminAuthError(data.error || "비밀번호가 일치하지 않습니다.");
      }
    } catch {
      setAdminAuthError("인증 서버 연결에 실패했습니다.");
    } finally {
      setIsAuthSubmitting(false);
    }
  };

  const handleAdminLogout = async () => {
    await fetch("/api/admin/auth", { method: "DELETE" }).catch(() => {});
    setIsAdmin(false);
  };

  const openCreateModal = () => {
    setViewingItem(null);
    setEditingId(null);
    setFormData(EMPTY_FORM);
    setManualUrlInput("");
    setImageSearchKeyword("");
    setImageCandidates([]);
    setRejectedImageUrls([]);
    setImageSearchError(null);
    setIsEditorOpen(true);
  };

  const openEditModal = (item: ArchiveItem) => {
    const itemIsKuji = detectIsIchibanKuji(item.title, item.maker, item.price);
    setViewingItem(null);
    setEditingId(item.id);
    setFormData({
      category: item.category,
      series: item.series,
      title: item.title,
      maker: item.maker,
      scale: item.scale,
      releaseDate: item.releaseDate,
      price: item.price,
      summary: item.summary,
      content: item.content || "",
      images: getItemImages(item),
    });
    setManualUrlInput("");
    setImageSearchKeyword(buildSmartFigureQuery(item.title, item.maker, item.scale, itemIsKuji));
    setImageCandidates([]);
    setRejectedImageUrls([]);
    setImageSearchError(null);
    setIsEditorOpen(true);
  };

  const toggleSelectCandidate = (img: SearchImageCandidate) => {
    setThumbFallbackMap((prev) => ({ ...prev, [img.url]: img.thumbnail }));
    setFormData((prev) => {
      const idx = prev.images.findIndex((u) => u === img.url || u === img.thumbnail);
      if (idx >= 0) {
        const next = [...prev.images];
        next.splice(idx, 1);
        return { ...prev, images: next };
      }
      return { ...prev, images: [...prev.images, img.url] };
    });
  };

  const handleExtractFrom1kujiPage = async (pageUrl: string) => {
    setIsExtractingKujiPage(true);
    setImageSearchError(null);
    try {
      const res = await fetch(`/api/kuji-extract?url=${encodeURIComponent(pageUrl.trim())}`);
      const data = await res.json();
      if (!res.ok) {
        setImageSearchError(data.error || "공식 페이지에서 이미지를 추출하지 못했습니다.");
        return;
      }
      const extracted: SearchImageCandidate[] = Array.isArray(data.images) ? data.images : [];
      if (extracted.length === 0) {
        setImageSearchError("추출된 피규어 공식 이미지가 없습니다.");
        return;
      }
      setCandidateSourceLabel(`1KUJI FIGURE EXTRACTED (${extracted.length}장)`);
      setImageCandidates(extracted);
      setRejectedImageUrls([]);
      setManualUrlInput("");
    } catch {
      setImageSearchError("1kuji.com 페이지를 불러오는 중 네트워크 오류가 발생했습니다.");
    } finally {
      setIsExtractingKujiPage(false);
    }
  };

  const handleAddManualUrl = () => {
    const trimmed = manualUrlInput.trim();
    if (!trimmed) return;
    if (is1kujiPageUrl(trimmed)) {
      handleExtractFrom1kujiPage(trimmed);
      return;
    }
    if (!formData.images.includes(trimmed)) {
      setFormData((prev) => ({ ...prev, images: [...prev.images, trimmed] }));
    }
    setManualUrlInput("");
  };

  const handleSearchOfficialImage = async (overrideQuery?: string, resetRejected = false) => {
    const autoQuery = buildSmartFigureQuery(
      formData.title,
      formData.maker,
      formData.scale,
      isKujiProduct
    );
    const finalQuery = (overrideQuery !== undefined ? overrideQuery : autoQuery).trim();
    if (!finalQuery || finalQuery === "figure" || finalQuery === "一番くじ") {
      window.alert("먼저 피규어 제목을 입력해 주세요!");
      return;
    }

    const selectedSet = new Set(formData.images);
    const unselected = resetRejected
      ? []
      : imageCandidates
          .filter((img) => !selectedSet.has(img.url) && !selectedSet.has(img.thumbnail))
          .flatMap((img) => [img.url, img.thumbnail]);

    const nextRejected = new Set<string>(
      resetRejected ? [] : [...rejectedImageUrls, ...unselected]
    );
    setRejectedImageUrls(Array.from(nextRejected));
    setImageSearchKeyword(finalQuery);
    setIsSearchingImages(true);
    setImageSearchError(null);

    try {
      const modeParam = isKujiProduct ? "&mode=kuji" : "";
      const res = await fetch(`/api/image-search?q=${encodeURIComponent(finalQuery)}${modeParam}`);
      const data = await res.json();
      if (!res.ok) {
        setImageSearchError(data.error || "이미지를 불러오지 못했습니다.");
        return;
      }
      const fresh = (Array.isArray(data.images) ? data.images : []).filter(
        (img: SearchImageCandidate) =>
          !nextRejected.has(img.url) && !nextRejected.has(img.thumbnail)
      );
      if (fresh.length === 0) {
        setImageCandidates([]);
        setImageSearchError("새로운 이미지 후보가 없습니다. 검색어를 수정해 보세요.");
        return;
      }
      setCandidateSourceLabel(isKujiProduct ? "1KUJI OFFICIAL CANDIDATES" : "MULTI-SELECT CANDIDATES");
      setImageCandidates(fresh.slice(0, 9));
    } catch {
      setImageSearchError("서버와 통신하는 중 오류가 발생했습니다.");
    } finally {
      setIsSearchingImages(false);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.series.trim()) {
      window.alert("작품명과 제목은 필수 입력 항목입니다.");
      return;
    }
    const cleanImages = formData.images.map((u) => u.trim()).filter(Boolean);
    const releaseStr = formData.releaseDate.trim() || "미정";
    const parsedYear = extractYear(releaseStr) || String(CURRENT_YEAR);

    if (editingId) {
      setItems((prev) =>
        prev.map((item) =>
          item.id === editingId
            ? {
                ...item,
                ...formData,
                series: formData.series.trim(),
                title: formData.title.trim(),
                maker: formData.maker.trim() || "미정",
                scale: formData.scale.trim() || "논스케일",
                releaseDate: releaseStr,
                price: formData.price.trim() || "정보 없음",
                summary: formData.summary.trim() || "아카이브 등록 항목입니다.",
                content: formData.content.trim(),
                images: cleanImages,
                imageUrl: cleanImages[0] || "",
              }
            : item
        )
      );
    } else {
      const nextNum = String(items.length + 1).padStart(3, "0");
      setItems((prev) => [
        {
          id: String(Date.now()),
          code: `FIG-${parsedYear}-${nextNum}`,
          category: formData.category,
          series: formData.series.trim(),
          title: formData.title.trim(),
          maker: formData.maker.trim() || "미정",
          scale: formData.scale.trim() || "논스케일",
          releaseDate: releaseStr,
          price: formData.price.trim() || "정보 없음",
          summary: formData.summary.trim() || "아카이브 등록 항목입니다.",
          content: formData.content.trim(),
          images: cleanImages,
          imageUrl: cleanImages[0] || "",
        },
        ...prev,
      ]);
    }
    setIsEditorOpen(false);
    setEditingId(null);
  };

  const handleDelete = (id: string, title: string) => {
    if (window.confirm(`'${title}' 항목을 삭제할까요?`)) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      if (viewingItem?.id === id) setViewingItem(null);
    }
  };

  const handleReset = () => {
    if (window.confirm("기본 도감 샘플 데이터로 초기화할까요?")) {
      setItems(DEFAULT_ARCHIVE);
      setSelectedSeries("전체");
      setSelectedCategory("전체");
      setSelectedYear("전체 연도");
      setSearchQuery("");
      setViewingItem(null);
      setLiveKujiResults([]);
      if (isAdmin && adminSessionPassword) { fetch("/api/archive", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: adminSessionPassword, items: DEFAULT_ARCHIVE }) }); }
    }
  };

  const viewingImages = viewingItem ? getItemImages(viewingItem) : [];
  const safeSlideIdx =
    viewingImages.length > 0 ? Math.min(activeSlideIdx, viewingImages.length - 1) : 0;

  return (
    <div className="min-h-screen bg-[#FAFAFA] font-sans text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-neutral-900" />
            <h1 onClick={handleSecretLogoClick} className="cursor-default select-none font-bold tracking-tight">FIGU ARCHIVE</h1>
            <span className="hidden rounded border border-neutral-200 bg-neutral-100 px-2 py-0.5 font-mono text-[11px] text-neutral-500 sm:inline-block">
              VER 2.9
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex">
            <button
                type="button"
                onClick={() => setSelectedCategory("전체")}
                className="font-semibold text-neutral-900 transition-colors"
              >
                전체 도감
              </button>
          </nav>

          <div className="flex items-center gap-2">
            {isAdmin && (<><button
              type="button"
              onClick={handleReset}
              className="hidden rounded-md border border-neutral-200 bg-white px-2.5 py-1.5 text-xs text-neutral-500 hover:border-neutral-400 sm:inline-block"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="rounded-md border border-neutral-900 bg-neutral-900 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-neutral-700"
            >
              + 관리자 기록
            </button><button type="button" onClick={handleAdminLogout} className="rounded-md border border-neutral-300 bg-neutral-100 px-2.5 py-1.5 text-xs font-medium text-neutral-600 hover:bg-neutral-200">로그아웃</button></>)}
          </div>
        </div>
      </header>

      <section className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-10 md:py-14">
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-neutral-400">
            SPECIMEN & FIGURE DATABASE
          </p>
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 className="max-w-2xl text-2xl font-bold tracking-tight text-neutral-900 md:text-3xl">
              <span className="block">처음 코딩 잡고 ai 치트키 써서</span><span className="block">13시간 52분 컷 한 웹사이트</span>
            </h2>
            {isAdmin && (
              <div className="flex flex-wrap items-center gap-2 self-start md:self-auto">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedManageIds([]);
                    setManageSearchQuery("");
                    setIsManageModalOpen(true);
                  }}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-4 py-2.5 text-xs font-bold text-neutral-900 hover:bg-neutral-100"
                >
                  📋 게시물 모음 관리 ({items.length}건)
                </button>
                <button
                  type="button"
                  disabled={isAutoPublishing}
                  onClick={() => handleBatchAutoPublish()}
                  className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-neutral-900 px-4 py-2.5 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {isAutoPublishing
                    ? "✍️ 피규어 전용 게시물화 중..."
                    : "📰 최신 이치방쿠지 자동 게시물 발행"}
                </button>
              </div>
            )}
          </div>

          {publishProgressText && (
            <div className="mt-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/80 px-3.5 py-2.5 text-xs font-medium text-blue-950">
              <span>{publishProgressText}</span>
              {!isAutoPublishing && (
                <button
                  type="button"
                  onClick={() => setPublishProgressText(null)}
                  className="ml-3 text-blue-600 hover:text-blue-900"
                >
                  ✕
                </button>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-2 gap-4 border-t border-neutral-100 pt-5 sm:max-w-xl sm:grid-cols-4">
            <div>
              <p className="font-mono text-xs text-neutral-400">TOTAL ENTRIES</p>
              <p className="mt-1 text-xl font-bold">{items.length}건</p>
            </div>
            <div>
              <p className="font-mono text-xs text-neutral-400">2027+ UPCOMING</p>
              <p className="mt-1 text-xl font-bold text-blue-700">{nextYearPlusCount}건</p>
            </div>
            <div>
              <p className="font-mono text-xs text-neutral-400">SERIES</p>
              <p className="mt-1 text-xl font-bold">{Math.max(seriesList.length - 1, 0)}개 분류</p>
            </div>
            <div>
              <p className="font-mono text-xs text-neutral-400">STORAGE</p>
              <p className="mt-1 text-xl font-bold text-emerald-700">AUTO SAVE</p>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1 sm:max-w-md">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleLiveSearchKuji(searchQuery);
                  }
                }}
                placeholder="피규어명, 작품명(봇치, 원피스, 에바) 검색..."
                className="w-full rounded-lg border border-neutral-300 bg-white py-2 pl-3.5 pr-9 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-neutral-800"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              disabled={isLiveSearchingKuji}
              onClick={() => handleLiveSearchKuji(searchQuery)}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50"
            >
              {isLiveSearchingKuji ? "⏳ 1kuji 검색 중..." : "🎯 1kuji 최신 정보 실시간 검색"}
            </button>
          </div>

          <div className="flex items-center gap-2 self-end lg:self-auto">
            <span className="font-mono text-[11px] text-neutral-400">SORT BY</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortType)}
              className="rounded-lg border border-neutral-300 bg-white px-3 py-2 text-xs font-medium text-neutral-700"
            >
              <option value="latest">등록 최신순</option>
              <option value="release-desc">발매일 최신순</option>
              <option value="release-asc">발매일 빠른순</option>
            </select>
          </div>
        </div>

        {(liveKujiResults.length > 0 || liveKujiError) && (
          <section className="mb-8 rounded-2xl border border-amber-300 bg-amber-50/50 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded bg-amber-500 px-2 py-0.5 font-mono text-[10px] font-bold text-white">
                  1KUJI.COM LIVE
                </span>
                <h3 className="text-sm font-bold text-amber-950">
                  이치방쿠지 공식 최신 정보 ({liveKujiLabel} · {liveKujiResults.length}건)
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {isAdmin && liveKujiResults.length > 0 && (
                  <button
                    type="button"
                    disabled={isAutoPublishing}
                    onClick={() => {
                      const startIdx = liveKujiPage * 9;
                      const orderedFromCurrentSlide = [
                        ...liveKujiResults.slice(startIdx),
                        ...liveKujiResults.slice(0, startIdx),
                      ];
                      handleBatchAutoPublish(orderedFromCurrentSlide);
                    }}
                    className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-neutral-700 disabled:opacity-50"
                  >
                    {isAutoPublishing ? "✍️ 일괄 게시물화 중..." : "⚡ 검색 결과 전체 자동 게시물화"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setLiveKujiResults([]);
                    setLiveKujiError(null);
                  }}
                  className="rounded-md border border-amber-200 bg-white px-2.5 py-1 text-xs text-amber-800"
                >
                  닫기 ✕
                </button>
              </div>
            </div>

            {liveKujiError && (
              <p className="rounded-lg border border-red-200 bg-white px-3.5 py-2.5 text-xs text-red-600">
                ⚠️ {liveKujiError}
              </p>
            )}

            {liveKujiResults.length > 0 && (() => {
              const KUJI_PER_PAGE = 9;
              const totalKujiPages = Math.max(1, Math.ceil(liveKujiResults.length / KUJI_PER_PAGE));
              const safeKujiPage = Math.min(liveKujiPage, totalKujiPages - 1);
              const paginatedLiveKujiResults = liveKujiResults.slice(
                safeKujiPage * KUJI_PER_PAGE,
                (safeKujiPage + 1) * KUJI_PER_PAGE
              );
              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1 text-xs text-amber-900/80">
                    <span>
                      전체 <strong className="text-amber-950">{liveKujiResults.length}건</strong> 중{" "}
                      <strong className="text-amber-700">
                        {safeKujiPage * KUJI_PER_PAGE + 1}~
                        {Math.min((safeKujiPage + 1) * KUJI_PER_PAGE, liveKujiResults.length)}번째
                      </strong>{" "}
                      표시 중
                    </span>
                    <span className="font-bold text-amber-950">
                      슬라이드 {safeKujiPage + 1} / {totalKujiPages}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {paginatedLiveKujiResults.map((kuji) => {
                  const pureKujiTitle = (() => {
                    const raw = kuji.title.trim();
                    const idx = raw.indexOf("一番くじ");
                    return (idx > 0 ? raw.slice(idx) : raw).trim().toLowerCase();
                  })();
                  const alreadySaved = items.some(
                    (it) =>
                      it.title.trim().toLowerCase().includes(pureKujiTitle) ||
                      it.content.includes(kuji.sourceUrl)
                  );
                  const isImporting = importingSlug === kuji.slug;
                  return (
                    <div
                      key={kuji.slug}
                      className="flex flex-col justify-between rounded-xl border border-amber-200 bg-white p-3.5"
                    >
                      <div className="flex flex-col gap-3">
                        <div className="h-56 w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                          {kuji.imageUrl ? (
                            <img
                              src={getDisplayImageUrl(kuji.imageUrl)}
                              alt={kuji.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain bg-neutral-50 transition-transform duration-300 hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center font-mono text-xs text-neutral-400">
                              1KUJI
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-800">
                              {kuji.releaseDate}
                            </span>
                            <span className="truncate text-[11px] font-medium text-neutral-500">
                              {kuji.series}
                            </span>
                          </div>
                          <p className="mt-1.5 line-clamp-2 text-sm font-bold text-neutral-900">
                            {kuji.title}
                          </p>
                          <p className="mt-1 font-mono text-xs text-neutral-500">{kuji.price}</p>
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-neutral-100 pt-2.5 text-[11px]">
                        <a
                          href={kuji.sourceUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-neutral-500 hover:underline"
                        >
                          공식 페이지 ↗
                        </a>
                        {isAdmin && (<button
                          type="button"
                          disabled={isImporting || alreadySaved}
                          onClick={() => handleAutoPublishSingle(kuji)}
                          className={`rounded-md px-2.5 py-1 font-semibold ${
                            alreadySaved
                              ? "bg-emerald-50 text-emerald-700"
                              : "bg-neutral-900 text-white hover:bg-neutral-700 disabled:opacity-50"
                          }`}
                        >
                          {isImporting
                            ? "✍️ 피규어 추출 중..."
                            : alreadySaved
                            ? "✓ 게시물 발행됨"
                            : "✍️ 자동 게시물 발행"}
                        </button>)}
                      </div>
                    </div>
                  );
                    })}
                  </div>

                  {totalKujiPages > 1 && (
                    <div className="flex flex-wrap items-center justify-center gap-2 border-t border-amber-200/80 pt-3">
                      <button
                        type="button"
                        onClick={() => setLiveKujiPage((prev) => Math.max(0, prev - 1))}
                        disabled={safeKujiPage === 0}
                        className="rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        ← 이전 슬라이드
                      </button>

                      <div className="flex items-center gap-1">
                        {Array.from({ length: totalKujiPages }).map((_, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => setLiveKujiPage(idx)}
                            className={`h-8 w-8 rounded-lg text-xs font-bold transition ${
                              safeKujiPage === idx
                                ? "bg-amber-600 text-white shadow-sm"
                                : "border border-amber-200 bg-white text-amber-900 hover:bg-amber-100"
                            }`}
                          >
                            {idx + 1}
                          </button>
                        ))}
                      </div>

                      <button
                        type="button"
                        onClick={() => setLiveKujiPage((prev) => Math.min(totalKujiPages - 1, prev + 1))}
                        disabled={safeKujiPage >= totalKujiPages - 1}
                        className="rounded-lg border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-bold text-amber-950 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        다음 슬라이드 →
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          </section>
        )}

        <div className="mb-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            {seriesList.map((series) => (
              <button
                key={series}
                type="button"
                onClick={() => setSelectedSeries(series)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium ${
                  selectedSeries === series
                    ? "border-neutral-900 bg-neutral-900 text-white"
                    : "border-neutral-200 bg-white text-neutral-600 hover:border-neutral-400"
                }`}
              >
                {series}
              </button>
            ))}
          </div>
          <span className="font-mono text-xs text-neutral-400">SHOWING {filteredItems.length} ITEMS</span>
        </div>

        <div className="mb-8 flex flex-wrap items-center gap-2 border-t border-neutral-200/70 pt-3">
          <span className="mr-1 font-mono text-[11px] font-semibold text-neutral-400">YEAR:</span>
          {yearFilterList.map((year) => {
            const count =
              year === "전체 연도"
                ? items.length
                : items.filter((item) => extractYear(item.releaseDate) === year).length;
            const isFutureYear = year !== "전체 연도" && Number(year) > CURRENT_YEAR;
            return (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] font-medium ${
                  selectedYear === year
                    ? "border-blue-600 bg-blue-600 text-white"
                    : isFutureYear
                    ? "border-blue-200 bg-blue-50/70 text-blue-700"
                    : "border-neutral-200 bg-white text-neutral-600"
                }`}
              >
                {year === "전체 연도" ? `전체 (${count})` : `${year}년 (${count})`}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredItems.map((item) => {
            const cardImages = getItemImages(item);
            const itemYear = extractYear(item.releaseDate);
            const isNextYearPlus = itemYear !== null && Number(itemYear) > CURRENT_YEAR;

            return (
              <article
                key={item.id}
                onClick={() => setViewingItem(item)}
                className="group flex cursor-pointer flex-col justify-between rounded-xl border border-neutral-200 bg-white p-5 transition hover:-translate-y-0.5 hover:border-neutral-400 hover:shadow-sm"
              >
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-[11px] text-neutral-400">{item.code}</span>
                      {isNextYearPlus && (
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600">
                          {itemYear} 예정
                        </span>
                      )}
                    </div>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                        item.category === "신제품"
                          ? "bg-blue-50 text-blue-700"
                          : "bg-amber-50 text-amber-700"
                      }`}
                    >
                      {item.category}
                    </span>
                  </div>

                  {cardImages.length > 0 ? (
                    <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg border border-neutral-200 bg-neutral-100">
                      <img
                        src={getDisplayImageUrl(cardImages[0])}
                        alt={item.title}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                      />
                      {cardImages.length > 1 && (
                        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-2 py-0.5 font-mono text-[10px] font-semibold text-white">
                          📷 1 / {cardImages.length}
                        </span>
                      )}
                    </div>
                  ) : (
                    <div className="mb-4 flex aspect-[4/3] w-full flex-col items-center justify-center rounded-lg border border-dashed border-neutral-200 bg-neutral-50 text-center">
                      <span className="font-mono text-xs text-neutral-400">IMAGE ARCHIVE</span>
                      <span className="mt-1 text-[11px] text-neutral-400">{item.series}</span>
                    </div>
                  )}

                  <p className="text-xs font-medium text-neutral-500">{item.series}</p>
                  <h3 className="mt-1 text-base font-bold text-neutral-900 group-hover:underline">
                    {item.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-xs text-neutral-500">{item.summary}</p>
                </div>

                <div className="mt-5 border-t border-neutral-100 pt-3 text-[11px]">
                  <div className="flex justify-between py-0.5">
                    <span className="text-neutral-400">제조사</span>
                    <span className="font-medium text-neutral-700">{item.maker}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-neutral-400">구성 / 스케일</span>
                    <span className="font-medium text-neutral-700">{item.scale}</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-neutral-400">발매 / 구분</span>
                    <span className="font-mono font-medium text-neutral-700">
                      {item.releaseDate} · {item.price}
                    </span>
                  </div>

                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="mt-3 flex items-center justify-between border-t border-neutral-100 pt-2.5"
                  >
                    <button
                      type="button"
                      onClick={() => setViewingItem(item)}
                      className="font-mono text-[11px] font-semibold text-neutral-500 hover:text-black"
                    >
                      상세 보기 →
                    </button>
                    {isAdmin && (<div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEditModal(item)}
                        className="rounded border border-neutral-200 px-2.5 py-1 text-[11px] font-medium text-neutral-600 hover:border-neutral-400"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item.id, item.title)}
                        className="rounded border border-red-100 bg-red-50/60 px-2.5 py-1 text-[11px] font-medium text-red-600"
                      >
                        삭제
                      </button>
                    </div>)}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </main>

      {viewingItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl md:p-8"
          >
            <div className="mb-5 flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-2.5">
                <span className="font-mono text-xs font-semibold text-neutral-400">
                  {viewingItem.code}
                </span>
                <span className="rounded bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700">
                  {viewingItem.category}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500"
              >
                닫기 ✕
              </button>
            </div>

            {viewingImages.length > 0 && (
              <div className="mb-6">
                <div className="relative aspect-[16/10] w-full overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50">
                  <img
                    src={getDisplayImageUrl(viewingImages[safeSlideIdx])}
                    alt={viewingItem.title}
                    referrerPolicy="no-referrer"
                    className="h-full w-full object-contain"
                  />
                  {viewingImages.length > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlideIdx(
                            (prev) => (prev - 1 + viewingImages.length) % viewingImages.length
                          )
                        }
                        className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 font-bold"
                      >
                        ‹
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSlideIdx((prev) => (prev + 1) % viewingImages.length)
                        }
                        className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border bg-white/90 font-bold"
                      >
                        ›
                      </button>
                      <span className="absolute bottom-3 right-3 rounded-full bg-black/75 px-3 py-1 font-mono text-[11px] text-white">
                        {safeSlideIdx + 1} / {viewingImages.length}
                      </span>
                    </>
                  )}
                </div>

                {viewingImages.length > 1 && (
                  <div className="mt-2.5 flex gap-2 overflow-x-auto pb-1">
                    {viewingImages.map((imgUrl, idx) => (
                      <button
                        key={`${imgUrl}-${idx}`}
                        type="button"
                        onClick={() => setActiveSlideIdx(idx)}
                        className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg border-2 ${
                          safeSlideIdx === idx ? "border-neutral-900" : "border-neutral-200 opacity-60"
                        }`}
                      >
                        <img
                          src={getDisplayImageUrl(imgUrl)}
                          alt={`썸네일 ${idx + 1}`}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs font-semibold text-neutral-500">{viewingItem.series}</p>
            <h3 className="mt-1 text-xl font-bold text-neutral-900">{viewingItem.title}</h3>
            <p className="mt-3 rounded-lg bg-neutral-50 p-3.5 text-xs text-neutral-700">
              {viewingItem.summary}
            </p>
            <div className="mt-6 whitespace-pre-line border-t border-neutral-100 pt-5 text-sm leading-relaxed text-neutral-700">
              {viewingItem.content}
            </div>

            <div className="mt-8 flex justify-end gap-2 border-t border-neutral-100 pt-4 text-xs">
              {isAdmin && (<button
                type="button"
                onClick={() => openEditModal(viewingItem)}
                className="rounded-lg border border-neutral-300 px-4 py-2 font-medium"
              >
                이 기록 수정
              </button>)}
              <button
                type="button"
                onClick={() => setViewingItem(null)}
                className="rounded-lg bg-neutral-900 px-5 py-2 font-medium text-white"
              >
                목록으로
              </button>
            </div>
          </div>
        </div>
      )}

      {isEditorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between border-b border-neutral-100 pb-4">
              <h3 className="text-lg font-bold text-neutral-900">
                {editingId ? "도감 기록 수정하기" : "새 아카이브 기록 등록"}
              </h3>
              <button
                type="button"
                onClick={() => setIsEditorOpen(false)}
                className="rounded-lg border border-neutral-200 px-2.5 py-1 text-xs text-neutral-500"
              >
                닫기 ✕
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">분류 *</label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as CategoryType })
                    }
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  >
                    <option value="신제품">신제품</option>
                    <option value="수집 가이드">수집 가이드</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold">작품명 *</label>
                  <input
                    type="text"
                    required
                    value={formData.series}
                    onChange={(e) => setFormData({ ...formData, series: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block font-semibold">제목 *</label>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">제조사</label>
                  <input
                    type="text"
                    value={formData.maker}
                    onChange={(e) => setFormData({ ...formData, maker: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">규격 / 스케일</label>
                  <input
                    type="text"
                    value={formData.scale}
                    onChange={(e) => setFormData({ ...formData, scale: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold">발매일</label>
                  <input
                    type="text"
                    value={formData.releaseDate}
                    onChange={(e) => setFormData({ ...formData, releaseDate: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold">가격 / 등급</label>
                  <input
                    type="text"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="font-semibold">
                    공식 슬라이드 이미지 ({formData.images.length}장)
                  </label>
                  {formData.category === "신제품" && (
                    <button
                      type="button"
                      disabled={isSearchingImages}
                      onClick={() => handleSearchOfficialImage()}
                      className="rounded-md bg-blue-50 px-2.5 py-1 font-semibold text-blue-700"
                    >
                      {isSearchingImages ? "⏳ 검색 중..." : "🔍 공식 이미지 검색"}
                    </button>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <input
                    type="url"
                    placeholder="이미지 URL 또는 1kuji.com 상품 페이지 URL 입력"
                    value={manualUrlInput}
                    onChange={(e) => setManualUrlInput(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2"
                  />
                  <button
                    type="button"
                    disabled={isExtractingKujiPage}
                    onClick={handleAddManualUrl}
                    className="rounded-lg bg-neutral-900 px-3 py-2 font-semibold text-white"
                  >
                    {isExtractingKujiPage
                      ? "추출 중..."
                      : inputLooksLikeKujiPage
                      ? "✨ 피규어 추출"
                      : "+ 추가"}
                  </button>
                </div>

                {imageSearchError && (
                  <p className="mt-2 text-[11px] text-red-600">⚠️ {imageSearchError}</p>
                )}

                {imageCandidates.length > 0 && (
                  <div className="mt-2.5 rounded-xl border border-blue-200 bg-blue-50/40 p-3">
                    <div className="mb-2 flex justify-between">
                      <span className="font-mono text-[10px] font-bold text-blue-800">
                        {candidateSourceLabel}
                      </span>
                      <button
                        type="button"
                        onClick={() => setImageCandidates([])}
                        className="text-[11px] text-neutral-500"
                      >
                        닫기 ✕
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {imageCandidates.map((img, idx) => {
                        const isSelected = formData.images.some(
                          (u) => u === img.url || u === img.thumbnail
                        );
                        return (
                          <button
                            key={`${img.url}-${idx}`}
                            type="button"
                            onClick={() => toggleSelectCandidate(img)}
                            className={`aspect-square overflow-hidden rounded-lg border-2 bg-white p-1 ${
                              isSelected ? "border-blue-600" : "border-neutral-200"
                            }`}
                          >
                            <img
                              src={getDisplayImageUrl(img.thumbnail)}
                              alt={img.title}
                              referrerPolicy="no-referrer"
                              className="h-full w-full object-contain"
                            />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {formData.images.length > 0 && (
                  <div className="mt-2.5 grid grid-cols-4 gap-2 rounded-xl border bg-neutral-50 p-2.5">
                    {formData.images.map((url, idx) => (
                      <div key={`${url}-${idx}`} className="relative rounded border bg-white p-1">
                        <img
                          src={getDisplayImageUrl(url)}
                          alt=""
                          referrerPolicy="no-referrer"
                          onError={() => {
                            const fb = thumbFallbackMap[url];
                            if (fb && fb !== url) {
                              setFormData((p) => ({
                                ...p,
                                images: p.images.map((u, i) => (i === idx ? fb : u)),
                              }));
                            }
                          }}
                          className="aspect-square w-full object-contain"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setFormData((p) => ({
                              ...p,
                              images: p.images.filter((_, i) => i !== idx),
                            }))
                          }
                          className="mt-1 w-full rounded bg-red-50 py-0.5 text-[10px] text-red-600"
                        >
                          삭제
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-1 block font-semibold">한 줄 요약</label>
                <input
                  type="text"
                  value={formData.summary}
                  onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block font-semibold">상세 본문</label>
                <textarea
                  rows={4}
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 border-t pt-4">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="rounded-lg border px-4 py-2"
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-neutral-900 px-5 py-2 text-white"
                >
                  {editingId ? "수정 완료" : "도감에 저장"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {isAdminModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          
        >
          <form
            onSubmit={handleAdminLoginSubmit}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-neutral-900">관리자 모드 인증</h3>
              <button
                type="button"
                
                className="text-xs text-neutral-400 hover:text-neutral-700"
               onClick={() => setIsAdminModalOpen(false)}>
                ✕
              </button>
            </div>
            <p className="mt-1.5 text-xs text-neutral-500">
              게시물 발행 · 수정 · 삭제 권한을 활성화하려면 비밀번호를 입력하세요.
            </p>
            <input
              type="password"
              autoFocus
              value={adminPasswordInput}
              onChange={(e) => setAdminPasswordInput(e.target.value)}
              placeholder="관리자 비밀번호"
              className="mt-4 w-full rounded-lg border border-neutral-300 px-3.5 py-2.5 text-sm outline-none focus:border-neutral-900"
            />
            {adminAuthError && (
              <p className="mt-2 text-xs font-medium text-red-600">{adminAuthError}</p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                
                className="rounded-lg border border-neutral-200 px-3.5 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-50"
               onClick={() => setIsAdminModalOpen(false)}>
                취소
              </button>
              <button
                type="submit"
                disabled={isAuthSubmitting}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-xs font-semibold text-white hover:bg-neutral-700 disabled:opacity-50"
              >
                {isAuthSubmitting ? "확인 중..." : "인증하기"}
              </button>
            </div>
          </form>
        </div>
      )}
      {isAdmin && isManageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div
            className="flex max-h-[85vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-neutral-200 px-6 py-4">
              <div>
                <h3 className="text-base font-bold text-neutral-900">📋 게시물 모음 관리</h3>
                <p className="mt-0.5 text-xs text-neutral-500">
                  전체 {items.length}건 (공개 {items.filter((i) => !i.hidden).length}건 · 숨김 {items.filter((i) => i.hidden).length}건) — 순서 이동, 숨김 전환, 일괄 삭제가 가능합니다.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
              >
                ✕ 닫기
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-neutral-100 bg-neutral-50 px-6 py-3">
              <input
                type="text"
                value={manageSearchQuery}
                onChange={(e) => setManageSearchQuery(e.target.value)}
                placeholder="제목, 코드, 시리즈, 제조사 검색..."
                className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-xs text-neutral-900 focus:border-neutral-900 focus:outline-none sm:w-60"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const filtered = items.filter((it) => {
                      const q = manageSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        it.title.toLowerCase().includes(q) ||
                        it.code.toLowerCase().includes(q) ||
                        it.series.toLowerCase().includes(q) ||
                        it.maker.toLowerCase().includes(q)
                      );
                    });
                    if (selectedManageIds.length === filtered.length && filtered.length > 0) {
                      setSelectedManageIds([]);
                    } else {
                      setSelectedManageIds(filtered.map((it) => it.id));
                    }
                  }}
                  className="rounded-lg border border-neutral-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-neutral-700 hover:bg-neutral-100"
                >
                  전체 선택/해제
                </button>
                <button
                  type="button"
                  disabled={selectedManageIds.length === 0}
                  onClick={() => {
                    setItems((prev) =>
                      prev.map((it) => (selectedManageIds.includes(it.id) ? { ...it, hidden: true } : it))
                    );
                  }}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-40"
                >
                  선택 숨김
                </button>
                <button
                  type="button"
                  disabled={selectedManageIds.length === 0}
                  onClick={() => {
                    setItems((prev) =>
                      prev.map((it) => (selectedManageIds.includes(it.id) ? { ...it, hidden: false } : it))
                    );
                  }}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                >
                  선택 공개
                </button>
                                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(items, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = "archive-seed.json";
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  className="rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100"
                >
                  📦 배포용 데이터 저장
                </button>
<button
                  type="button"
                  disabled={selectedManageIds.length === 0 || isRefreshingPosts}
                  onClick={() => handleRefreshArchiveItems(selectedManageIds)}
                  className="rounded-lg border border-blue-300 bg-blue-50 px-2.5 py-1.5 text-xs font-bold text-blue-800 hover:bg-blue-100 disabled:opacity-40"
                >
                  {isRefreshingPosts ? "🔄 갱신 중..." : `🔄 선택 최신 갱신 (${selectedManageIds.length}건)`}
                </button>
                <button
                  type="button"
                  disabled={selectedManageIds.length === 0}
                  onClick={() => {
                    if (selectedManageIds.length === 0) return;
                    if (!window.confirm(`선택한 ${selectedManageIds.length}개의 게시물을 정말 삭제하시겠습니까?`)) return;
                    setItems((prev) => prev.filter((it) => !selectedManageIds.includes(it.id)));
                    setSelectedManageIds([]);
                  }}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-40"
                >
                  선택 삭제 ({selectedManageIds.length}건)
                </button>
              </div>
            </div>

            {refreshProgressText && (
              <div className="flex items-center justify-between border-b border-blue-200 bg-blue-50/90 px-6 py-2 text-xs font-medium text-blue-950">
                <span>{refreshProgressText}</span>
                {!isRefreshingPosts && (
                  <button
                    type="button"
                    onClick={() => setRefreshProgressText(null)}
                    className="ml-3 text-blue-600 hover:text-blue-900"
                  >
                    닫기 ✕
                  </button>
                )}
              </div>
            )}

            <div className="flex-1 divide-y divide-neutral-100 overflow-y-auto px-6 py-2">
              {items
                .filter((it) => {
                  const q = manageSearchQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    it.title.toLowerCase().includes(q) ||
                    it.code.toLowerCase().includes(q) ||
                    it.series.toLowerCase().includes(q) ||
                    it.maker.toLowerCase().includes(q)
                  );
                })
                .map((it) => {
                  const checked = selectedManageIds.includes(it.id);
                  const realIdx = items.findIndex((x) => x.id === it.id);
                  const isFirst = realIdx === 0;
                  const isLast = realIdx === items.length - 1;

                  const moveItem = (targetIdx: number) => {
                    if (realIdx < 0 || targetIdx < 0 || targetIdx >= items.length || realIdx === targetIdx) return;
                    setItems((prev) => {
                      const next = [...prev];
                      const [moved] = next.splice(realIdx, 1);
                      next.splice(targetIdx, 0, moved);
                      return next;
                    });
                  };

                  return (
                    <div
                      key={it.id}
                      className={`flex items-center justify-between gap-3 py-3 text-xs transition-colors ${
                        it.hidden ? "bg-neutral-50/90 opacity-65" : "hover:bg-neutral-50/80"
                      }`}
                    >
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedManageIds((prev) => [...prev, it.id]);
                            } else {
                              setSelectedManageIds((prev) => prev.filter((id) => id !== it.id));
                            }
                          }}
                          className="h-4 w-4 rounded border-neutral-300 text-neutral-900"
                        />
                        <span className="w-6 shrink-0 text-center font-mono text-[11px] font-bold text-neutral-400">
                          #{realIdx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-neutral-500">
                            {it.hidden && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">
                                숨김됨
                              </span>
                            )}
                            <span className="font-mono font-semibold text-neutral-700">{it.code}</span>
                            <span>·</span>
                            <span>{it.series}</span>
                            <span>·</span>
                            <span>{it.releaseDate}</span>
                          </div>
                          <p className="mt-0.5 truncate font-bold text-neutral-900">{it.title}</p>
                        </div>
                      </label>

                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          title="맨 앞으로 이동"
                          disabled={isFirst}
                          onClick={() => moveItem(0)}
                          className="rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ⇤
                        </button>
                        <button
                          type="button"
                          title="한 칸 앞으로 이동"
                          disabled={isFirst}
                          onClick={() => moveItem(realIdx - 1)}
                          className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          title="한 칸 뒤로 이동"
                          disabled={isLast}
                          onClick={() => moveItem(realIdx + 1)}
                          className="rounded border border-neutral-200 bg-white px-2 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          title="맨 뒤로 이동"
                          disabled={isLast}
                          onClick={() => moveItem(items.length - 1)}
                          className="rounded border border-neutral-200 bg-white px-1.5 py-1 text-[11px] font-bold text-neutral-700 hover:bg-neutral-100 disabled:opacity-30"
                        >
                          ⇥
                        </button>

                        <button
                          type="button"
                          title="공식 최신 정보 및 이미지로 갱신"
                          disabled={isRefreshingPosts}
                          onClick={() => handleRefreshArchiveItems([it.id])}
                          className="ml-1 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700 hover:bg-blue-100 disabled:opacity-40"
                        >
                          갱신
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setItems((prev) =>
                              prev.map((item) => (item.id === it.id ? { ...item, hidden: !item.hidden } : item))
                            );
                          }}
                          className={`ml-1 rounded-md border px-2.5 py-1 text-[11px] font-bold ${
                            it.hidden
                              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                              : "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                          }`}
                        >
                          {it.hidden ? "공개 전환" : "숨김"}
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (!window.confirm(`"${it.title}" 게시물을 삭제하시겠습니까?`)) return;
                            setItems((prev) => prev.filter((item) => item.id !== it.id));
                            setSelectedManageIds((prev) => prev.filter((id) => id !== it.id));
                          }}
                          className="rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600 hover:bg-red-100"
                        >
                          삭제
                        </button>
                      </div>
                    </div>
                  );
                })}
              {items.length === 0 && (
                <div className="py-12 text-center text-xs text-neutral-400">
                  등록된 게시물이 없습니다.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}