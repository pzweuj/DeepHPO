import json
import os

# Resolve paths relative to the project root (one level up from tools/)
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_FILE = os.path.join(BASE_DIR, "public", "hpo_terms_cn.json")
OUTPUT_FILE = os.path.join(BASE_DIR, "public", "hpo_terms_cn.txt")

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    lines = ["HPO_ID\tname\tname_cn"]
    for hpo_id, entry in data.items():
        name = entry.get("name", "")
        name_cn = entry.get("name_cn", "")
        lines.append(f"{hpo_id}\t{name}\t{name_cn}")

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")

    print(f"Done. Wrote {len(lines) - 1} entries to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
