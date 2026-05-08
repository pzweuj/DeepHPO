#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""从 hpo_terms_cn.json 中提取 name 和 name_cn，去重排序后生成 txt 文件。"""

import json
import os

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(SCRIPT_DIR)
INPUT_FILE = os.path.join(PROJECT_ROOT, "public", "hpo_terms_cn.json")
OUTPUT_FILE = os.path.join(PROJECT_ROOT, "public", "hpo_names.txt")


def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    names = set()
    for entry in data.values():
        if "name" in entry and entry["name"]:
            names.add(entry["name"])
        if "name_cn" in entry and entry["name_cn"]:
            names.add(entry["name_cn"])

    sorted_names = sorted(names, key=lambda s: s.lower())

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        for name in sorted_names:
            f.write(name + "\n")

    print(f"共提取 {len(sorted_names)} 个不重复名称，已写入 {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
