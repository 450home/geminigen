# GeminiGen HuggingFace Downloader

从 geminigen.ai 自动下载生成的图片并保存到本地。

## 功能特性

- ✅ 自动登录 geminigen.ai
- ✅ 保存和管理登录 cookies
- ✅ 自动检测 cookies 是否过期
- ✅ 批量下载 dashboard 中的图片
- ✅ 镜像名称和时间戳命名

## 环境变量

在 HuggingFace Space 的 Settings > Secrets 中配置：

```
GEM_EMAIL=your_email@example.com
GEM_PASS=your_password
```

## 文件结构

```
geminigen/
├── app.py                  # HuggingFace Space 入口文件
├── requirements.txt        # Python 依赖
├── worker/
│   ├── hf_downloader.js    # 主下载脚本
│   └── .cookies.json       # 自动生成的 cookies（本地存储）
└── downloads/              # 下载的图片存储位置
```

## 工作流程

1. **Cookie 管理**
   - 首次运行时自动登录并保存 cookies
   - 后续运行时复用 cookies（如有效）
   - cookies 过期自动重新登录

2. **图片下载**
   - 访问 https://geminigen.ai/dashboard/images
   - 提取所有 Cloudinary 图片链接
   - 下载并保存到 `downloads/` 目录

3. **文件命名**
   - 格式：`geminigen_{timestamp}_{index}.jpg`
   - 例如：`geminigen_1710024000000_0.jpg`

## 本地运行

```bash
# 安装依赖
npm install

# 安装 Playwright 浏览器
npx playwright install chromium

# 设置环境变量
export GEM_EMAIL="your_email@example.com"
export GEM_PASS="your_password"

# 运行
node worker/hf_downloader.js
```

## 部署到 HuggingFace

1. 创建新的 Space：`450home/geminigen-hf`
2. 选择 SDK：Gradio 或 Docker
3. 上传代码（或连接 GitHub 仓库）
4. 在 Secrets 中添加环境变量
5. Space 会自动启动并执行下载

## 注意事项

- ⚠️ 请妥善保管账号密码
- ⚠️ 不要在公开仓库中泄露环境变量
- ⚠️ 定期检查 cookies 有效性
- 💡 可以设置 Space 为 Private 以保护数据
