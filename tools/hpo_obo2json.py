# coding=utf-8
# pzw
# 20250210
# 将hpo提供的源文件处理为json
# http://purl.obolibrary.org/obo/hp.obo

import json

def obo_to_json(obo_file, json_file):
    hpo_terms = []
    current_term = None
    in_term = False  # 添加标志位，用于判断是否在[Term]部分
    
    with open(obo_file, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.strip()
            if line.startswith('[Term]'):
                in_term = True
                if current_term:
                    hpo_terms.append(current_term)
                current_term = {}
            elif line.startswith('[Typedef]'):
                in_term = False  # 遇到[Typedef]时，忽略后续内容
            elif in_term and current_term is not None:  # 确保只在[Term]部分处理
                if line.startswith('id:'):
                    current_term['id'] = line.split(': ')[1]
                elif line.startswith('name:'):
                    current_term['name'] = line.split(': ')[1]
                elif line.startswith('def:'):
                    current_term['definition'] = line.split('"')[1]
                elif line.startswith('is_a:'):
                    if 'is_a' not in current_term:
                        current_term['is_a'] = []
                    current_term['is_a'].append(line.split(' ')[1])
            elif line == '' and current_term:
                hpo_terms.append(current_term)
                current_term = None
    
    # 添加最后一个term
    if current_term:
        hpo_terms.append(current_term)
    
    with open(json_file, 'w', encoding='utf-8') as f:
        json.dump(hpo_terms, f, ensure_ascii=False, indent=4)

if __name__ == '__main__':
    obo_to_json('hp.obo', 'hpo_terms.json')

# end
