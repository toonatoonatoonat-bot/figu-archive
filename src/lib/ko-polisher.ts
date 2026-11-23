const PRE_GLOSSARY: [RegExp, string][] = [
  [/一番くじ/g, "이치방쿠지"],
  [/ラストワン賞/g, "라스트원상"],
  [/ダブルチャンスキャンペーン/g, "더블찬스 캠페인"],
  [/ダブルチャンス/g, "더블찬스"],
  [/描きおろし|描き下ろし/g, "신규 일러스트"],
  [/MASTERLISE\s*EXTRA/gi, "마스터라이즈 엑스트라"],
  [/MASTERLISE\s*EXPIECE/gi, "마스터라이즈 엑스피스"],
  [/MASTERLISE/gi, "마스터라이즈"],
  [/Gracemaster/gi, "그레이스마스터"],
  [/REVIBLE\s*MOMENT/gi, "리바이블 모멘트"],
  [/SOFVIMATES/gi, "소프비메이츠"],
  [/ちょこのっこ/g, "쵸코놋코"],
  [/きゅんキャラ/g, "큥캐릭터"],
  [/アクリルスタンド/g, "아크릴 스탠드"],
  [/クリアファイル/g, "클리어파일"],
  [/ラバーコースター/g, "러버 코스터"],
  [/ラバーチャーム/g, "러버 참"],
  [/ラバーストラップ/g, "러버 스트랩"],
  [/ビジュアルボード/g, "비주얼 보드"],
  [/タオルコレクション/g, "타월 컬렉션"],
  [/ハンドタオル/g, "핸드 타월"],
  [/グラスコレクション/g, "글라스 컬렉션"],
  [/ミニのぼり/g, "미니 노보리"],
  [/フィギュア/g, "피규어"],
  [/ぬいぐるみ/g, "봉제인형"],
  [/ハズレなしのキャラクターくじ/g, "꽝 없는 캐릭터 복권"],
  [/メーカー希望小売価格/g, "권장 소비자가"],
  [/順次発売予定/g, "순차 발매 예정"],
  [/取扱店/g, "취급점"],
  [/店頭販売/g, "매장 판매"],
  [/オンライン販売/g, "온라인 판매"],
  [/ぼっち・ざ・ろっく！|ぼっち・ざ・ろっく!/g, "봇치 더 록!"],
  [/後藤ひとり/g, "고토 히토리"],
  [/伊地知虹夏/g, "이지치 니지카"],
  [/山田リョウ/g, "야마다 료"],
  [/喜多郁代/g, "키타 이쿠요"],
  [/廣井きくり/g, "히로이 키쿠리"],
  [/伊地知星歌/g, "이지치 세이카"],
  [/学園アイドルマスター/g, "학원 아이돌마스터"],
  [/紫雲清夏/g, "시운 스미카"],
  [/葛城リーリヤ/g, "카츠라기 릴리야"],
  [/姫崎莉波/g, "히메사키 리나미"],
  [/花海咲季/g, "하나미 사키"],
  [/月村手毬/g, "츠키무라 테마리"],
  [/藤田ことね/g, "후지타 코토네"],
  [/有村麻央/g, "아리무라 마오"],
  [/篠澤広/g, "시노사와 히로"],
  [/倉本千奈/g, "쿠라모토 치나"],
  [/花海佑芽/g, "하나미 우메"],
  [/十王星南/g, "쥬오 세나"],
];

export function hasJapaneseChars(text: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9faf]/.test(text);
}

export function clean1kujiNoise(text: string): string {
  if (!text) return "";
  let out = text;
  out = out.replace(/(?:未定|미정)\s*(?:商品カテゴリー|상품\s*카테고리)[^\n]*/g, "추후 공개");
  out = out.replace(/[•\-*]?\s*(?:ダブルチャンス|더블\s*찬스)[^\n]*(?:挑戦方法|도전\s*방법|会員登録|회원\s*등록|LINEアカウント|公式ショップ|発売日[～~]|店舗の事情により)[^\n]*\n?/g, "");
  out = out.replace(/(?:ダブルチャンス|더블\s*찬스)[^\n/]*(?:挑戦方法|도전\s*방법|会員登録|회원\s*등록|発売日[～~]|店舗の事情により)[^\n/]*\/?\s*/g, "");
  out = out.replace(/税込\s*10%/g, "세금 10% 포함");
  return out;
}

export function polishKoreanKujiText(text: string): string {
  if (!text) return "";
  let out = clean1kujiNoise(text);

  const postFixes: [RegExp, string][] = [
    [/이치\s*반\s*쿠지|가장\s*복권|제일\s*복권|이치방\s*복권/g, "이치방쿠지"],
    [/이치\s*반\s*코후레/g, "이치방 코프레"],
    [/라스트\s*원\s*상|마지막\s*하나\s*상/g, "라스트원상"],
    [/라스트\s*원\s*Ver\.?/gi, "라스트원 Ver."],
    [/라스트\s*원\b/g, "라스트원"],
    [/더블\s*찬스\s*캠페인/g, "더블찬스 캠페인"],
    [/더블\s*찬스/g, "더블찬스"],
    [/학원\s*아이돌\s*마스터/g, "학원 아이돌마스터"],
    [/봇치\s*더\s*록\s*!/g, "봇치 더 록!"],
    [/시운청\s*여름|시운\s*청\s*여름/g, "시운 스미카"],
    [/카츠라기\s*리리아/g, "카츠라기 릴리야"],
    [/히메사키\s*리와/g, "히메사키 리나미"],
    [/고토\s*외톨이|고토\s*히토리/g, "고토 히토리"],
    [/이지치\s*무지개\s*여름|이지치\s*니지카/g, "이지치 니지카"],
    [/키타\s*이쿠요/g, "키타 이쿠요"],
    [/야마다\s*료/g, "야마다 료"],
    [/그린\s*내리기|그린\s*오로시|그려진/g, "신규 일러스트"],
    [/러버\s*매력/g, "러버 참"],
    [/미니\s*스톱/g, "미니스톱"],
    [/공식\s*숍/g, "공식 샵"],
    [/취미\s*숍|취미\s*가게|하비\s*숍/g, "하비 샵"],
    [/피겨/g, "피규어"],
    [/([A-Z])\s*상\b/g, "$1상"],
    [/전\s*(\d+)\s*종/g, "총 $1종"],
    [/약\s*(\d+(?:\.\d+)?)\s*cm/gi, "약 $1cm"],
    [/\(세입\)/g, "(세금 포함)"],
    [
      /일본\s*전국의\s*편의점이나\s*서점,\s*하비\s*샵\s*등에서\s*판매하고\s*있는\s*오리지널\s*상품이\s*맞는\s*하즐레\s*없는\s*캐릭터\s*복권!\s*반드시\s*하나의\s*상품을\s*얻을\s*수\s*있습니다!\s*게다가\s*가게에서\s*마지막\s*복권을\s*당기면\s*특별한\s*라스트원상을\s*얻을\s*수\s*있습니다!?/g,
      "일본 전국 편의점과 서점, 하비 샵 등에서 판매되는 꽝 없는 캐릭터 복권입니다. 어떤 등급이든 반드시 경품을 획득할 수 있으며, 매장에서 마지막 남은 복권을 뽑으면 특별한 라스트원상까지 함께 받을 수 있습니다."
    ],
    [/하즐레\s*없는\s*캐릭터\s*복권!?/g, "꽝 없는 캐릭터 복권입니다."],
    [/반드시\s*하나의\s*상품을\s*얻을\s*수\s*있습니다!?/g, "어떤 등급이든 반드시 경품을 획득할 수 있습니다."],
    [/가게에서\s*마지막\s*복권을\s*당기면\s*특별한\s*라스트원상을\s*얻을\s*수\s*있습니다!?/g, "매장에서 마지막 복권을 뽑으면 특별한 라스트원상을 받을 수 있습니다."],
    [/\s+([,.)\]])/g, "$1"],
    [/([(\[])\s+/g, "$1"],
    [/[ \t]{2,}/g, " "],
  ];

  for (const [pattern, replacement] of postFixes) {
    out = out.replace(pattern, replacement);
  }

  out = out
    .split("\n")
    .map((line) => {
      let trimmed = line.trim();
      // 괄호 안에 동일한 한국어 제목이 한 번 더 반복된 경우 정리 (예: "이치방쿠지 X (이치방쿠지 X)")
      trimmed = trimmed.replace(/^(.{6,60})\s*\(\1\)$/, "$1");
      // 경품 줄 내 중복 텍스트 제거
      const dupLineMatch = trimmed.match(/^([•\-*]?\s*(?:[A-Z]상|라스트원상)\s*:\s*)(.+?)\s+(?:[A-Z]상|라스트원상)\s+.+?(\s*\[피규어\])?$/);
      if (dupLineMatch) {
        trimmed = `${dupLineMatch[1]}${dupLineMatch[2].trim()}${dupLineMatch[3] || ""}`;
      }
      return trimmed;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return out;
}

async function fetchGoogleTranslate(q: string): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=ko&dt=t&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    },
  });
  if (!res.ok) return q;
  const data = await res.json();
  if (Array.isArray(data?.[0])) {
    return (
      data[0]
        .map((seg: unknown) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : ""))
        .join("")
        .trim() || q
    );
  }
  return q;
}

export async function autoTranslateAndPolish(text: string): Promise<string> {
  const trimmed = clean1kujiNoise(text || "").trim();
  if (!trimmed) return "";

  let preProcessed = trimmed;
  for (const [pattern, replacement] of PRE_GLOSSARY) {
    preProcessed = preProcessed.replace(pattern, replacement);
  }

  if (!hasJapaneseChars(preProcessed)) {
    return polishKoreanKujiText(preProcessed);
  }

  try {
    // 줄 단위로 나누어 번역해야 긴 본문에서도 중간 일본어가 누락되지 않음
    const lines = preProcessed.split("\n");
    const translatedLines = await Promise.all(
      lines.map(async (line) => {
        if (!line.trim() || !hasJapaneseChars(line)) return line;
        return await fetchGoogleTranslate(line);
      })
    );
    return polishKoreanKujiText(translatedLines.join("\n"));
  } catch {
    return polishKoreanKujiText(preProcessed);
  }
}

export async function autoTranslateArchiveItem<T extends Record<string, unknown>>(item: T): Promise<T> {
  const fields = [
    "title",
    "series",
    "maker",
    "scale",
    "releaseDate",
    "price",
    "summary",
    "content",
    "prizeCounts",
    "lotTotal",
    "maxPerTry",
    "offlineOpenDate",
    "onlineOpenDate",
  ];

  const next: Record<string, unknown> = { ...item };
  for (const f of fields) {
    const val = next[f];
    if (typeof val === "string" && val.trim()) {
      next[f] = await autoTranslateAndPolish(val);
    }
  }

  // 제목 끝의 중복 괄호 표기 정리 (예: "제목 (제목)")
  if (typeof next.title === "string") {
    next.title = next.title.replace(/^(.{5,70})\s*\(\1\)$/, "$1").trim();
  }

  if (typeof next.content === "string") {
    const lineCount = next.content
      .split("\n")
      .filter((l) => /^•\s*(?:[A-Z]상|라스트원상)\s*:/.test(l.trim())).length;
    if (lineCount > 0) {
      next.content = next.content.replace(
        /■ 주요 경품 라인업 \(\d+종 확인\)/,
        `■ 주요 경품 라인업 (${lineCount}종 확인)`
      );
    }
  }

  return next as T;
}