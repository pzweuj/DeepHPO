#!/usr/bin/env node

/**
 * 环境变量检查脚本
 * 用于诊断DeepHPO的API配置问题
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 DeepHPO 环境变量检查工具\n');
console.log('=' .repeat(50));

// 检查 .env.local 和 .env 文件
const envLocalPath = path.join(__dirname, '.env.local');
const envPath = path.join(__dirname, '.env');
const envLocalExists = fs.existsSync(envLocalPath);
const envExists = fs.existsSync(envPath);

console.log('\n📝 文件检查:');
console.log(`  .env.local 文件: ${envLocalExists ? '✅ 存在 (推荐)' : '❌ 不存在'}`);
console.log(`  .env 文件: ${envExists ? '✅ 存在' : '❌ 不存在'}`);

if (!envLocalExists && !envExists) {
  console.log('\n❌ 错误: .env.local 和 .env 文件都不存在！');
  console.log('\n解决方案:');
  console.log('  1. 复制模板文件:');
  console.log('     Copy-Item .env.local.self .env.local  # 推荐');
  console.log('  2. 编辑 .env.local 文件，填入你的API Key');
  console.log('  3. 重新运行此脚本验证');
  process.exit(1);
}

if (envExists && !envLocalExists) {
  console.log('\n⚠️  警告: 仅找到 .env 文件，建议使用 .env.local');
  console.log('  原因: .env.local 优先级高于系统环境变量，避免冲突');
  console.log('  建议: Copy-Item .env .env.local');
}

// 读取 .env.local 或 .env 文件（优先 .env.local）
const targetEnvPath = envLocalExists ? envLocalPath : envPath;
const envContent = fs.readFileSync(targetEnvPath, 'utf-8');
console.log(`\n正在检查: ${envLocalExists ? '.env.local' : '.env'}`);
const envVars = {};

envContent.split('\n').forEach(line => {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith('#')) {
    const [key, ...valueParts] = trimmed.split('=');
    if (key) {
      envVars[key.trim()] = valueParts.join('=').trim();
    }
  }
});

console.log('\n🔑 环境变量检查:');

// 检查必需的变量
const requiredVars = {
  'API_KEY': 'API密钥',
  'API_URL': 'API端点',
  'MODEL': '模型名称'
};

let hasErrors = false;

Object.entries(requiredVars).forEach(([key, description]) => {
  const value = envVars[key];
  const exists = !!value;
  const isEmpty = !value || value === '';
  
  let status = '❌';
  let message = '未配置';
  
  if (exists && !isEmpty) {
    status = '✅';
    // 隐藏API Key的大部分内容
    if (key === 'API_KEY') {
      const masked = value.substring(0, 7) + '...' + value.substring(value.length - 4);
      message = masked;
    } else {
      message = value;
    }
  } else {
    hasErrors = true;
  }
  
  console.log(`  ${status} ${description} (${key}): ${message}`);
});

// 验证API URL格式
if (envVars.API_URL) {
  const url = envVars.API_URL;
  const isValid = url.startsWith('http://') || url.startsWith('https://');
  console.log(`\n🌐 API URL验证:`);
  console.log(`  ${isValid ? '✅' : '❌'} URL格式: ${isValid ? '正确' : '错误（必须以http://或https://开头）'}`);
  
  if (!url.includes('/anthropic')) {
    console.log(`  ⚠️  警告: URL可能不正确，应为Anthropic API基础地址`);
  }
}

// 提供建议
console.log('\n💡 建议:');

if (hasErrors) {
  console.log('  ❌ 配置不完整，请完善 .env 文件');
  console.log('\n  示例配置:');
  console.log('  API_KEY=sk-your-api-key-here');
  console.log('  API_URL=https://api.deepseek.com/anthropic');
  console.log('  MODEL=deepseek-v4-pro');
} else {
  console.log('  ✅ 配置看起来正确！');
  console.log('\n  下一步:');
  console.log('  1. 启动或重启开发服务器:');
  console.log('     - 如果已运行，按 Ctrl+C 停止');
  console.log('     - 然后运行: npm run dev');
  console.log('  2. 访问: http://localhost:3000');
  console.log('  3. 切换到LLM模式测试');
  console.log('\n  ⚠️  重要: 修改 .env 文件后必须重启服务器！');
  console.log('\n  如果仍有问题，查看:');
  console.log('  - 浏览器控制台 (F12) 的详细日志');
  console.log('  - DEBUG_API.md 文件了解调试方法');
}

// API提供商识别
console.log('\n🏢 API提供商:');
const url = envVars.API_URL || '';
let provider = '未知';

if (url.includes('deepseek.com')) {
  provider = 'DeepSeek (Anthropic API)';
} else if (url.includes('anthropic.com')) {
  provider = 'Anthropic 官方';
}

console.log(`  识别为: ${provider}`);

// 检查系统环境变量冲突
console.log('\n⚠️  系统环境变量检查:');
const sysEnvKey = process.env.API_KEY;
if (sysEnvKey) {
  console.log('  ⚠️  检测到系统环境变量 API_KEY');
  console.log(`  系统值: ${sysEnvKey.substring(0, 10)}...`);
  if (envVars.API_KEY && envVars.API_KEY !== sysEnvKey) {
    console.log('  ❌ 警告: 系统环境变量与文件不同！');
    console.log('  Next.js会使用系统环境变量，忽略.env文件');
    console.log('  解决: 使用 .env.local 或删除系统环境变量');
  }
} else {
  console.log('  ✅ 未检测到系统环境变量冲突');
}

// 常见问题提示
console.log('\n📚 常见问题:');
console.log('  • "Invalid token" (401) → 查看 DEBUG_API.md');
console.log('  • "No choices in API response" → 查看 ENV_SETUP.md#常见问题排查');
console.log('  • API Key无效 → 检查是否正确复制，是否有多余空格');
console.log('  • 配额不足 → 访问API提供商控制台检查余额');
console.log('  • 环境变量未生效 → 必须重启服务器 (Ctrl+C 后 npm run dev)');

console.log('\n' + '='.repeat(50));
console.log('检查完成！\n');

if (hasErrors) {
  process.exit(1);
}
