# coding=utf-8
# pzw
# 20250212
# 知识库向量化

import sys
import json
import requests
import time
import numpy as np

def vectorize_json(input_file, output_file, api_token):
    # 读取原始JSON文件
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # 创建单独的向量存储字典
    embeddings = {}
    
    # 检查是否已有部分向量文件存在
    try:
        existing_embeddings = np.load(output_file, allow_pickle=True)
        for key in existing_embeddings.keys():
            embeddings[key] = existing_embeddings[key]
        print(f"检测到已有{len(embeddings)}个term的向量，将从断点处继续...")
    except FileNotFoundError:
        print("未找到已有向量文件，将从头开始处理...")
    
    # API配置
    url = "https://api.siliconflow.cn/v1/embeddings"
    headers = {
        "Authorization": f"Bearer {api_token}",
        "Content-Type": "application/json"
    }
    
    # 遍历处理每个条目
    for term_id, term_data in data.items():
        # 如果该term已经处理过，跳过
        if term_id in embeddings:
            continue
            
        # 使用名称和定义作为向量文本
        text = f"{term_data.get('name', '')} {term_data.get('definition', '')} {term_data.get('name_cn', '')} {term_data.get('definition_cn', '')}"
        print(f"正在处理: {term_id}")
        if not text.strip():
            continue
        
        # 如果文本过长，进行截断
        max_tokens = 8192
        if len(text) > max_tokens:
            text = text[:max_tokens]
            print(f"警告：{term_id} 文本过长，已截断前{max_tokens}个字符")
            
        payload = {
            "model": "BAAI/bge-m3",
            "input": text,
            "encoding_format": "float"
        }
        
        try:
            response = requests.post(url, json=payload, headers=headers)
            if response.status_code == 200:
                embedding = response.json()['data'][0]['embedding']
                # 将向量转换为float16并降维
                embedding = np.array(embedding, dtype=np.float16)
                embedding = embedding[:512]  # 保留前512维
                embeddings[term_id] = embedding
            else:
                print(f"Error processing {term_id}: {response.text}")
        except Exception as e:
            print(f"API请求失败: {str(e)}")
            break  # 遇到错误时退出循环，保留已处理的数据
        
        time.sleep(2)  # 防止请求过载
    
    # 分别保存原始数据和向量数据
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    # 保存向量数据到单独文件，使用zstd压缩
    np.savez_compressed(output_file, **embeddings, compression='zstd')

token = sys.argv[1]
vectorize_json("hpo_terms_cn.json", "hpo_terms_cn_embd.npz", token)

