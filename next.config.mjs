/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    DEEPSEEK_API_KEY: process.env.DEEPSEEK_API_KEY,
  },
  
  // 优化构建配置
  webpack: (config, { isServer }) => {
    // 排除大型JSON文件被打包到客户端bundle
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
      };
    }
    
    // 服务端配置：标记 nodejieba 为外部依赖
    if (isServer) {
      config.externals = config.externals || [];
      if (Array.isArray(config.externals)) {
        config.externals.push('nodejieba');
      }
    }
    
    return config;
  },
  
  // 启用生产优化
  swcMinify: true,
  
  // 优化图片
  images: {
    formats: ['image/avif', 'image/webp'],
  },
  
  // 压缩
  compress: true,
};

export default nextConfig;
