# coding=utf-8
# pzw
# 20250530
# 将已完成的结果形成Done List

import json

data = json.load(open("hpo_terms_cn.json", "r", encoding="utf-8"))
done_list = list(data.keys())

with open("done_list.txt", "w", encoding="utf-8") as f:
	for i in done_list:
		f.write(i + "\n")


