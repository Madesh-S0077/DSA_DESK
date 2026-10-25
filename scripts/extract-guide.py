"""Extract DSA_Prep_Guide.pdf into data/guide.json.

Pure stdlib: decodes the Skia-generated PDF via its ToUnicode CMaps, then parses
topic tables, pattern cards, problem details, revision lists and simulation sets.

Usage: python scripts/extract-guide.py [path/to/DSA_Prep_Guide.pdf]
"""
import json
import re
import sys
import unicodedata
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "DSA_Prep_Guide.pdf"
OUT = ROOT / "data" / "guide.json"

TOPICS = [
    "Arrays & Hashing", "Two Pointers", "Sliding Window", "Binary Search", "Linked Lists",
    "Stack & Monotonic Stack", "Queue & Monotonic Queue", "Recursion & Backtracking", "Trees",
    "Heap / Priority Queue", "Graphs", "Dynamic Programming", "Greedy", "Intervals",
    "Bit Manipulation", "Math & Number Theory", "Tries", "Advanced Data Structures",
]
LEVELS = {"🟢": 1, "🔵": 2, "🟠": 3, "🔴": 4}

# Titles whose LeetCode slug is not a plain slugify of the guide's title.
SLUG_OVERRIDES = {
    "Maximum Subarray (Kadane's)": "maximum-subarray",
    "Insert Delete GetRandom O(1)": "insert-delete-getrandom-o1",
    "Pow(x, n)": "powx-n",
}

# Section 21 roadmap, transcribed (table cells wrap unpredictably in the PDF).
ROADMAP = [
    {"week": 1, "topics": "Arrays & Hashing", "from": 1, "to": 16, "revision": "", "mock": []},
    {"week": 2, "topics": "Two Pointers, Sliding Window", "from": 17, "to": 34, "revision": "Re-solve 3 hardest from Week 1", "mock": []},
    {"week": 3, "topics": "Binary Search, Linked Lists", "from": 35, "to": 57, "revision": "Re-solve 3 hardest from Week 2", "mock": []},
    {"week": 4, "topics": "Stack & Monotonic Stack, Queue", "from": 58, "to": 75, "revision": "Weeks 1–3 spot check (5 random)", "mock": [1]},
    {"week": 5, "topics": "Recursion & Backtracking", "from": 76, "to": 88, "revision": "Re-solve 3 hardest from Week 4", "mock": []},
    {"week": 6, "topics": "Trees (part 1: traversal, BST)", "from": 89, "to": 100, "revision": "Weeks 1–5 spot check", "mock": [3]},
    {"week": 7, "topics": "Trees (part 2: construction, hard)", "from": 101, "to": 104, "revision": "Re-solve 3 hardest from Week 6", "mock": []},
    {"week": 8, "topics": "Heap / Priority Queue", "from": 105, "to": 114, "revision": "Weeks 1–7 spot check", "mock": [4]},
    {"week": 9, "topics": "Graphs (part 1: BFS/DFS, Union-Find)", "from": 115, "to": 126, "revision": "Re-solve 3 hardest from Week 8", "mock": []},
    {"week": 10, "topics": "Graphs (part 2: topo sort, Dijkstra, hard)", "from": 127, "to": 133, "revision": "Weeks 1–9 spot check", "mock": [3, 8]},
    {"week": 11, "topics": "Dynamic Programming (part 1: 1D, knapsack)", "from": 134, "to": 148, "revision": "Re-solve 3 hardest from Week 10", "mock": []},
    {"week": 12, "topics": "Dynamic Programming (part 2: 2D, hard)", "from": 149, "to": 160, "revision": "Weeks 1–11 spot check", "mock": [5, 6]},
    {"week": 13, "topics": "Greedy, Intervals", "from": 161, "to": 176, "revision": "Re-solve 3 hardest from Week 12", "mock": [7]},
    {"week": 14, "topics": "Bit Manipulation, Math, Tries", "from": 177, "to": 198, "revision": "Weeks 1–13 spot check", "mock": [9]},
    {"week": 15, "topics": "Advanced Data Structures + 50 Essential repeat", "from": 199, "to": 203, "revision": "Full 50 Essential re-solve", "mock": [2, 10]},
    {"week": 16, "topics": "Mock-interview week, weakest-topic re-drill", "from": None, "to": None, "revision": "Targeted re-solve of every Mistake Log entry", "mock": []},
]

TRACK_A_SKIP = {"Graphs", "Dynamic Programming", "Tries", "Advanced Data Structures"}
TRACK_A_TOPICS = [
    "Arrays & Hashing", "Two Pointers", "Sliding Window", "Binary Search", "Linked Lists",
    "Stack & Monotonic Stack", "Recursion & Backtracking", "Trees", "Intervals", "Greedy",
]


# ---------------------------------------------------------------- PDF decoding
def pdf_text(data: bytes) -> str:
    objs = {int(m.group(1)): m.group(2) for m in re.finditer(rb"(\d+) 0 obj(.*?)endobj", data, re.S)}

    def stream(o):
        m = re.search(rb"stream\r?\n(.*?)\r?\nendstream", o, re.S)
        if not m:
            return b""
        s = m.group(1)
        if b"FlateDecode" in o:
            try:
                s = zlib.decompress(s)
            except zlib.error:
                return b""
        return s

    def cmap(n):
        s, mp = stream(objs[n]), {}
        for blk in re.findall(rb"beginbfchar(.*?)endbfchar", s, re.S):
            for a, b in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
                mp[int(a, 16)] = bytes.fromhex(b.decode()).decode("utf-16-be", "ignore")
        for blk in re.findall(rb"beginbfrange(.*?)endbfrange", s, re.S):
            for a, b, c in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", blk):
                a, b, cb = int(a, 16), int(b, 16), bytes.fromhex(c.decode())
                for i in range(a, b + 1):
                    last = (int.from_bytes(cb[-2:], "big") + i - a).to_bytes(2, "big")
                    mp[i] = (cb[:-2] + last).decode("utf-16-be", "ignore")
        return mp

    fonts = {}
    for n, o in objs.items():
        m = re.search(rb"/ToUnicode (\d+) 0 R", o)
        if m:
            fonts[n] = cmap(int(m.group(1)))

    lines = []
    for o in objs.values():
        if not re.search(rb"/Type /Page\b(?!s)", o):
            continue
        fm = re.search(rb"/Font\s*<<(.*?)>>", o, re.S)
        if not fm:
            rm = re.search(rb"/Resources (\d+) 0 R", o)
            fm = rm and re.search(rb"/Font\s*<<(.*?)>>", objs[int(rm.group(1))], re.S)
        page_fonts = {name: fonts.get(int(ref), {}) for name, ref in re.findall(rb"/(\w+) (\d+) 0 R", fm.group(1) if fm else b"")}
        for c in re.findall(rb"/Contents (\d+) 0 R", o):
            cur, line = {}, ""
            for tok in re.finditer(rb"/(\w+) [\d.]+ Tf|<([0-9A-Fa-f]*)>|\b(ET)\b", stream(objs[int(c)])):
                if tok.group(1):
                    cur = page_fonts.get(tok.group(1), {})
                elif tok.group(2) is not None:
                    h = tok.group(2).decode()
                    line += "".join(cur.get(int(h[i:i + 4], 16), "") for i in range(0, len(h), 4))
                elif line:
                    lines.append(line)
                    line = ""
            if line:
                lines.append(line)
    # NFKC folds ligatures like "ﬁ"; emoji are unaffected.
    return unicodedata.normalize("NFKC", "\n".join(lines))


# ---------------------------------------------------------------- parsing
def slugify(title: str) -> str:
    if title in SLUG_OVERRIDES:
        return SLUG_OVERRIDES[title]
    s = title.lower().replace("'", "").replace("’", "")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


DETAIL_LABELS = [
    ("pattern", r"Primary/Secondary Pattern"), ("concept", r"Key [Cc]oncept"), ("why", r"Why it matters"),
    ("prereqs", r"Prerequisites|Prereqs?"), ("approach", r"Approach(?: \([^)]*\))?"), ("insight", r"Insight"),
    ("mistake", r"(?:Common )?[Mm]istake"), ("variation", r"Variations?|Follow-ups?"), ("companies", r"Companies"),
]


COMPANIES = {
    "Amazon", "Google", "Meta", "Microsoft", "LinkedIn", "Bloomberg", "Uber", "Apple", "Adobe",
    "Airbnb", "Yelp", "Pinterest", "Twitter", "Snapchat", "Palantir",
}
COMPANY_ALIASES = {"Facebook": "Meta", "Facebook/Meta": "Meta"}


def parse_companies(raw: str) -> dict:
    """'Amazon, Google — extremely frequently asked (often a warm-up)' -> names + the free-text note.

    The note after the dash (or in parentheses) can itself contain commas, so cut it off before splitting.
    'everywhere' means the problem is asked across the board rather than at a named company.
    """
    raw = raw.strip(" .")
    names, _, note = raw.partition(" — ")
    paren = re.search(r"\s*\(([^)]*)\)", names)
    if paren:
        note = ", ".join(x for x in (paren.group(1), note) if x)
        names = names[:paren.start()] + names[paren.end():]
    out = {"companies": []}
    for n in (x.strip(" .") for x in names.split(",")):
        if not n:
            continue
        if n == "everywhere":
            out["everywhere"] = True
            continue
        n = COMPANY_ALIASES.get(n, n)
        assert n in COMPANIES, f"unknown company {n!r} in {raw!r}"
        if n not in out["companies"]:
            out["companies"].append(n)
    if note:
        out["companyNote"] = note[0].upper() + note[1:]
    return out


def parse_detail(body: str) -> dict:
    body = re.sub(r"\s+", " ", body).strip()
    # Some entries omit the "Primary/Secondary Pattern" label and start with ": <pattern>."
    if body.startswith(":"):
        body = "Primary/Secondary Pattern" + body
    body = re.sub(r"(?<=\. )Matters (?=as |for )", "Why it matters: ", body)
    alt = "|".join(f"(?P<{k}>{p}):" for k, p in DETAIL_LABELS)
    marks = list(re.finditer(alt, body))
    out = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        out.setdefault(m.lastgroup, body[m.end():end].strip())
    if "companies" in out:
        out.update(parse_companies(out["companies"]))
    body = body.lstrip("— ")
    out["text"] = body
    # Cross-listed problems ("see #55, listed again as ...") carry no details of their own.
    m = re.search(r"\(see (?:also )?#(\d+)", body)
    if m:
        out["seeAlso"] = int(m.group(1))
    return out


def main():
    text = pdf_text(PDF.read_bytes())
    lines = [l.strip() for l in text.split("\n")]

    # Topic section starts: "N. Topic" lines after the table of contents.
    starts = []
    for i, l in enumerate(lines):
        for t_i, t in enumerate(TOPICS):
            if l == f"{t_i + 1}. {t}" and (not starts or i > starts[-1][1]) and len(starts) == t_i:
                if any(lines[j] == "Pattern Card" for j in range(i + 1, min(i + 4, len(lines)))):
                    starts.append((t, i))
    assert len(starts) == 18, f"found {len(starts)} topic headers"
    end_idx = next(i for i, l in enumerate(lines) if l == "19. Learning Tracks")
    bounds = [(t, s, starts[k + 1][1] if k + 1 < len(starts) else end_idx) for k, (t, s) in enumerate(starts)]

    problems, topics = [], []
    for topic, s, e in bounds:
        sec = lines[s:e]
        joined = " ".join(sec)
        card = {}
        for key, label, nxt in [
            ("signals", "Recognition signals:", "Core idea:"), ("core", "Core idea:", "Typical complexity:"),
            ("complexity", "Typical complexity:", "Common traps:"), ("traps", "Common traps:", "Problems to practice:"),
        ]:
            m = re.search(re.escape(label) + r"(.*?)" + re.escape(nxt), joined)
            card[key] = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
        topics.append({"name": topic, "card": card})

        # Table: "#", "Problem", "Difficulty", "Level", "Priority", then rows of 5 cells.
        h = next(i for i, l in enumerate(sec) if l == "#" and sec[i + 1] == "Problem")
        d = next(i for i, l in enumerate(sec) if l == "Problem Details")
        cells = [c for c in sec[h + 5:d] if c]
        rows = []
        i = 0
        while i + 4 < len(cells):
            if not cells[i].isdigit():
                i += 1
                continue
            no, title, diff, lvl, pri = cells[i:i + 5]
            # Long titles may wrap onto two cells.
            if diff not in ("Easy", "Medium", "Hard"):
                title, diff, lvl, pri = f"{title} {diff}", lvl, pri, cells[i + 5]
                i += 1
            assert diff in ("Easy", "Medium", "Hard") and lvl in LEVELS, (topic, cells[i:i + 6])
            rows.append({"no": int(no), "title": title, "difficulty": diff, "level": LEVELS[lvl], "priority": pri.count("⭐")})
            i += 5

        details_text = "\n".join(sec[d + 1:])
        # A header is "#N. <title>" followed by a "— Difficulty" line; body text also has "#27." cross-references.
        heads = [re.search(rf"(?m)^#{r['no']}\. .*$(?=\n\s*—)", details_text) for r in rows]
        for k, r in enumerate(rows):
            m = heads[k]
            if m:
                nxt = next((h.start() for h in heads[k + 1:] if h), len(details_text))
                body = re.sub(r"^\s*—.*?⭐+\s*", "", details_text[m.end():nxt], flags=re.S)
                r["details"] = parse_detail(body)
            else:
                r["details"] = {}
            r["topic"] = topic
            r["slug"] = slugify(r["title"])
            r["url"] = f"https://leetcode.com/problems/{r['slug']}/"
            problems.append(r)

    problems.sort(key=lambda p: p["no"])
    nos = [p["no"] for p in problems]
    assert nos == list(range(1, 204)), f"problem numbers not 1..203: {len(nos)} found, missing {set(range(1, 204)) - set(nos)}"

    by_name = {norm(p["title"]): p["no"] for p in problems}
    by_name.update({norm(re.sub(r"\s*\(.*?\)", "", p["title"])): p["no"] for p in problems})

    def resolve(names):
        out, missing = [], []
        for n in names:
            k = norm(n)
            if k in by_name:
                out.append(by_name[k])
            else:
                missing.append(n)
        assert not missing, f"unresolved list names: {missing}"
        return out

    def section(a, b):
        ia = next(i for i, l in enumerate(lines) if l.startswith(a))
        ib = next(i for i, l in enumerate(lines) if i > ia and l.startswith(b))
        return " ".join(lines[ia + 1:ib])

    ess_names = [n.strip() for n in section("20.1", "20.2").split("·")]
    core_raw = section("20.2", "20.3").split("plus:", 1)[1]
    core_extra = [n.strip() for n in core_raw.split("·")]
    essential = resolve(ess_names)
    core = essential + resolve(core_extra)

    sims = []
    sim_text = section("20.5", "21. ")
    for m in re.finditer(r"Simulation (\d+) \((.*?)\):\s*(.*?)(?=Simulation \d+ \(|$)", sim_text):
        names = [n.strip() for n in re.sub(r"\s+", " ", m.group(3)).replace("Non- overlapping", "Non-overlapping").split("→")]
        sims.append({"id": int(m.group(1)), "name": m.group(2), "problems": resolve(names)})
    assert len(sims) == 10, f"found {len(sims)} simulations"

    m = re.search(r"Highest-ROI problems.*?\):(.*?)If time is critically short", " ".join(lines))
    hi_roi = resolve([n.strip(" .") for n in m.group(1).split(",")])

    tracks = {
        "A": sorted(p["no"] for p in problems if p["level"] <= 2 and p["topic"] not in TRACK_A_SKIP),
        "B": sorted(p["no"] for p in problems if p["priority"] >= 4),
        "C": nos,
    }
    track_a_order = TRACK_A_TOPICS

    guide = {
        "source": "MAANG-Focused LeetCode DSA Preparation Guide",
        "topics": topics,
        "problems": problems,
        "tracks": tracks,
        "trackATopicOrder": track_a_order,
        "lists": {"essential": essential, "core": core, "highestRoi": hi_roi},
        "simulations": sims,
        "roadmap": ROADMAP,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(guide, ensure_ascii=False, indent=1), encoding="utf-8")

    no_details = [p["no"] for p in problems if not p["details"].get("approach") and "seeAlso" not in p["details"]]
    print(f"problems={len(problems)} topics={len(topics)} essential={len(essential)} core={len(core)} "
          f"sims={len(sims)} roi={len(hi_roi)} trackA={len(tracks['A'])} trackB={len(tracks['B'])}")
    if no_details:
        print("WARNING: no details for", no_details)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()
