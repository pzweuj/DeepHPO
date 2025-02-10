# coding=utf-8
# pzw
# 20250210
# 使用deepseek-v3对HPO进行翻译
# 使用硅基流动API
# 注意对话时间间隔

import json
import requests
import time

# 硅基流动 Deepseek-V3 || 如果用其他服务商，可自行调整
def silicon_deepseek_v3(message, sdk):
    url = "https://api.siliconflow.cn/v1/chat/completions"
    
    payload = {
        "model": "deepseek-ai/DeepSeek-V3",
        "messages": [
            {
                "role": "system",
                "content": "你是一名医疗行业翻译专家，请对我提供的内容严格使用专业医学术语进行翻译，直接输出结果即可，不要输出其他内容。"
            },
            {
                "role": "user",
                "content": message
            }
        ],
        "stream": False,
        "max_tokens": 1024,
        "temperature": 0.3,
        "top_p": 0.5,
        "frequency_penalty": 0.2,
        "presence_penalty": 0.1,
        "response_format": {"type": "text"}
    }
    
    headers = {
        "Authorization": f"Bearer {sdk}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(url, json=payload, headers=headers)
        response.raise_for_status()  # 如果响应状态码不是200，将抛出HTTPError异常
        return response.json()['choices'][0]['message']['content']
    except requests.exceptions.HTTPError as err:
        print(f"HTTP错误: {err}")
        if response.status_code == 429:
            print("请求过多，请稍后再试")
        elif response.status_code == 503:
            print("服务不可用，请稍后再试")
        elif response.status_code == 504:
            print("网关超时，1分钟后重试")
            time.sleep(60)
            return silicon_deepseek_v3(message, sdk)
        exit(1)  # 退出程序，返回非0状态码表示异常退出
    except Exception as e:
        print(f"发生未知错误: {e}")
        exit(1)

# 运行
def run(sdk):
    done_list = []
    dl = open('done_list.txt', "r", encoding="utf-8")
    for line in dl:
        done_list.append(line.rstrip())
    dl.close()
    dl = open('done_list.txt', "a", encoding="utf-8")
    with open('hpo_terms.json', 'r') as file, open("hpo_terms_cn.txt", "a", encoding="utf-8") as o:
        data_dict = json.load(file)
        for term in data_dict:
            id = term.get("id", "-")

            if not id in done_list:
                print("[Process]", id)
                name = term.get("name", "-")
                des = term.get("definition", "-")
                name_cn = des_cn = "-"
                if name != "-":
                    name_cn = silicon_deepseek_v3(name, sdk) if name != "All" else "所有表型"
                if des != "-":
                    des_cn = silicon_deepseek_v3(des, sdk)
                time.sleep(3)

                term['name'] = name
                term['definition'] = des
                term['name_cn'] = name_cn
                term['definition_cn'] = des_cn

                o.write(str(term) + "\n")
                dl.write(id + "\n")

# 因为网络原因，没有将结果一次性生成json，这里重新转换
def tran2json():
    output_dict = {}
    with open("hpo_terms_cn.txt", "r", encoding="utf-8") as i:
        for line in i:
            id = "-"
            line = line.lstrip("{")
            line = line.rstrip("}\n")
            for j in line.split("', '"):
                key, value = j.split("': '")
                key = key.lstrip("'").rstrip("'")
                value = value.lstrip("'").rstrip("'")
                if key == "id":
                    id = value
                    output_dict.setdefault(id, {})
                output_dict[id][key] = value

    with open('hpo_terms_cn.json', 'w', encoding='utf-8') as f:
        json.dump(output_dict, f, ensure_ascii=False, indent=4)

###############
run("<硅基流动API密钥>")
tran2json()


