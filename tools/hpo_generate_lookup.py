# coding=utf-8
# pzw
# 从 hpo_terms_cn.json 生成压缩术语表，供 LLM 上下文使用
# 输出格式：HP:ID|英文名|中文名|中文定义

import json
import os

def generate_lookup_table(json_file, output_file):
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    lines = []
    for hpo_id, term in data.items():
        # 跳过根节点
        if hpo_id == 'HP:0000001':
            continue

        name = (term.get('name') or '').replace('|', '/')
        name_cn = (term.get('name_cn') or '').replace('|', '/')
        def_cn = (term.get('definition_cn') or '-').replace('\n', ' ').replace('|', '/')

        lines.append(f'{hpo_id}|{name}|{name_cn}|{def_cn}')

    with open(output_file, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines) + '\n')

    print(f'Generated {output_file}: {len(lines)} terms')

if __name__ == '__main__':
    base_dir = os.path.join(os.path.dirname(__file__), '..', 'public')
    json_file = os.path.join(base_dir, 'hpo_terms_cn.json')
    output_file = os.path.join(base_dir, 'hpo_lookup_table.txt')
    generate_lookup_table(json_file, output_file)

# end
