#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
update_captions.py  (v3 — 캡션 + 페이지 정보 FIGPAGE 포함판)
이미지 재렌더링 없이 캡션과 'PDF 페이지 번호'만 다시 추출한다 (수십 초 소요).
v3와 같은 순서·필터로 이미지 번호를 재현하고, 페이지 전체의 "Figure X-Y." 캡션 블록을
모아 각 이미지에 '가장 가까운 아래쪽 캡션'을 매칭한다.

결과: ~/Downloads/general_figures2/captions.js
  → window.FIGCAP (캡션) + window.FIGPAGE (도면별 PDF 페이지)
  → 이 파일 '하나만' GitHub general 저장소의 images/ 폴더에 덮어쓰기 업로드하면 됨.

사용법:
  python3 ~/Downloads/update_captions.py
"""
import os, sys, re, json

try:
    import fitz
except ImportError:
    sys.exit("PyMuPDF 필요:  pip3 install pymupdf --break-system-packages")

HOME = os.path.expanduser("~")
PDF = os.path.join(HOME, "Downloads", "amtg_handbook.pdf")
OUTDIR = os.path.join(HOME, "Downloads", "general_figures2")
MIN_PT = 55

CHAP_PHRASES = [
    ("ground operations",       "ch10_ground_operation"),
    ("regulations, maintenance", "ch11_regulations"),
    ("mathematics",             "ch02_mathematics"),
    ("aircraft drawings",       "ch05_aircraft_drawings"),
    ("physics",                 "ch03_basic_physics"),
    ("weight and balance",      "ch06_weight_balance"),
    ("materials, hardware",     "ch07_materials_processes"),
    ("corrosion control",       "ch08_corrosion_control"),
    ("fluid lines",             "ch09_fluid_lines"),
    ("inspection concepts",     "ch11_regulations"),
    ("hand tools",              "ch14_tools"),
]
END_PHRASES = ["appendix", "glossary", "acronym", "index", "references", "credits", "bibliograph"]
FIG_RE = re.compile(r'Figure\s+\d+[\-–]\d+[a-zA-Z]?\.?', re.I)

if not os.path.exists(PDF):
    sys.exit("PDF 없음: %s" % PDF)
os.makedirs(OUTDIR, exist_ok=True)

doc = fitz.open(PDF)
toc = doc.get_toc()
starts = {}
for lvl, title, pg in toc:
    t = title.lower()
    for phrase, cid in CHAP_PHRASES:
        if phrase in t and cid not in starts:
            starts[cid] = pg
bounds = sorted((pg, cid) for cid, pg in starts.items())
last_start = bounds[-1][0]
end_page = 10 ** 9
for lvl, title, pg in toc:
    if pg > last_start and any(e in title.lower() for e in END_PHRASES):
        end_page = min(end_page, pg)

def cid_for_page(p1):
    cur = None
    for pg, cid in bounds:
        if p1 >= pg:
            cur = cid
        else:
            break
    return cur

counter, caps, seen = {}, {}, set()
pages = {}
matched = 0
for pno in range(doc.page_count):
    p1 = pno + 1
    if p1 >= end_page:
        break
    cid = cid_for_page(p1)
    if not cid:
        continue
    page = doc[pno]
    page_area = abs(page.rect.width * page.rect.height)

    # 1) 이 페이지의 캡션 블록 수집 (Figure X-Y. 로 시작하는 텍스트 블록)
    cap_blocks = []
    for b in page.get_text("blocks"):
        x0, y0, x1, y1, text = b[0], b[1], b[2], b[3], (b[4] or "")
        t = " ".join(text.split())
        m = FIG_RE.search(t)
        if m and m.start() < 15:
            cap_blocks.append({"rect": fitz.Rect(x0, y0, x1, y1), "text": t[m.start():][:220], "used": False})

    # 2) v3와 같은 순서·필터로 이미지 열거 → 번호 재현
    for img in page.get_images(full=True):
        xref = img[0]
        if xref in seen:
            continue
        seen.add(xref)
        try:
            rects = page.get_image_rects(xref)
        except Exception:
            continue
        if not rects:
            continue
        r = rects[0]
        if r.width < MIN_PT or r.height < MIN_PT:
            continue
        if (r.width * r.height) > page_area * 0.92:
            continue
        counter[cid] = counter.get(cid, 0) + 1
        key = "%s_fig%d" % (cid, counter[cid])
        pages[key] = p1

        # 3) 캡션 매칭
        best, best_d = None, 1e9
        for cb in cap_blocks:
            if cb["used"]:
                continue
            cr = cb["rect"]
            dy = cr.y0 - r.y1
            if dy < -30 or dy > 150:
                continue
            overlap = min(r.x1, cr.x1) - max(r.x0, cr.x0)
            d = dy + (0 if overlap > 10 else 60)
            if d < best_d:
                best, best_d = cb, d
        if best is None:
            for cb in cap_blocks:
                if cb["used"]:
                    continue
                d = abs(cb["rect"].y0 - r.y1)
                if d < best_d:
                    best, best_d = cb, d
        if best is not None:
            best["used"] = True
            caps[key] = best["text"]
            matched += 1

open(os.path.join(OUTDIR, "captions.js"), "w", encoding="utf-8").write(
    "window.FIGCAP=" + json.dumps(caps, ensure_ascii=False) + ";"
    + "window.FIGPAGE=" + json.dumps(pages) + ";")

total = sum(counter.values())
print("완료 ✅  이미지 %d개 | 캡션 %d개(%.0f%%) | 페이지정보(FIGPAGE) %d개 → %s/captions.js"
      % (total, matched, matched / total * 100 if total else 0, len(pages), OUTDIR))
for cid in sorted(counter):
    have = sum(1 for k in caps if k.startswith(cid))
    print("   %-26s %3d개 (캡션 %d)" % (cid, counter[cid], have))
print("\n다음: captions.js 하나만 GitHub images/ 폴더에 업로드(덮어쓰기)하면 됩니다.")
