# coding=utf-8
# pzw
# 20250530
# 合并新旧json

import json

new = json.load(open('hpo_terms_cn_new.json', 'r', encoding='utf-8'))
old = json.load(open('hpo_terms_cn.json', 'r', encoding='utf-8'))

for j in new:
    if "is_a" in new[j]:
        del new[j]["is_a"]

merge = old
for i in new:
    merge[i] = new[i]

# 对merge按key进行排序
merge = dict(sorted(merge.items(), key=lambda item: item[0]))
json.dump(merge, open('hpo_terms_cn_merge.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=2)

# 人工确认后修改名称

