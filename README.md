---
title: GeminiGen Image Downloader
emoji: 🖼️
colorFrom: blue
colorTo: purple
sdk: docker
pinned: false
---

# GeminiGen HuggingFace Downloader

从 geminigen.ai 自动下载生成的图片并保存到 S3 存储。

## ✅ 部署状态

Space 已成功启动！🎉

## 📝 快速开始

### 1. 配置环境变量

访问 Space 设置页面：https://huggingface.co/spaces/tndai/geminigen-hf/settings

点击 **"Secrets and variables"** → **"New secret"**，添加以下配置：

**必要配置（必须添加）：**

```
Name: GEM_EMAIL
Value: 你的 geminigen.ai 注册邮箱
```

```
Name: GEM_PASS
Value: 你的 geminigen.ai 登录密码
```

**可选配置（代码中已有默认值）：**

```
Name: S3_ACCESS_KEY
Value: C9RGITP8OGS65986RZ50
```

```
Name: S3_SECRET_KEY
Value: QMjdC0LNHgUNrZNJajD1oszq24fFlNYqElyfcCqh
```

### 2. 重启 Space

添加环境变量后，需要重启 Space 使其生效：

- 在 Space 页面点击 **"Settings"**
- 找到 **"Restart"** 按钮
- 点击重启，等待几分钟让 Space 重新启动

### 3. 测试 API

Space 提供以下 API 端点：

#### 查看状态
```bash
curl https://huggingface.co/spaces/tndai/geminigen-hf/
```

#### 健康检查
```bash
curl https://huggingface.co/spaces/tndai/geminigen-hf/health
```

#### 触发下载任务
```bash
curl -X POST https://huggingface.co/spaces/tndai/geminigen-hf/run
```

### 4. 使用 Python 测试

```python
import requests

# 触发下载任务
response = requests.post(
    "https://huggingface.co/spaces/tndai/geminigen-hf/run"
)

result = response.json()
print(result)

if result.get("success"):
    print("✅ 下载成功！")
    print(result.get("stdout"))
else:
    print("❌ 下载失败")
    print(result.get("error"))
```

## 📦 存储配置

图片将自动上传到 S3 存储：

- **Endpoint:** https://s3.hi168.com
- **Bucket:** hi168-25505-58814hj4
- **路径格式:** `geminigen/{timestamp}_{index}.jpg`

## 🔍 工作流程

1. **Cookie 管理**
   - 首次运行自动登录 geminigen.ai
   - 保存 cookies 到本地文件
   - 后续运行自动复用 cookies
   - cookies 过期自动重新登录

2. **图片下载**
   - 访问 geminigen.ai dashboard
   - 提取所有 Cloudinary 图片
   - 下载并上传到 S3

3. **结果返回**
   - 返回下载的图片数量
   - 显示每张图片的 S3 URL
   - 包含详细的执行日志

## ⚠️ 注意事项

- **必须先配置环境变量**：GEM_EMAIL 和 GEM_PASS 是必须的
- **重启 Space**：添加环境变量后需要重启
- **等待启动**：重启后等待 2-3 分钟让 Space 完全启动
- **超时时间**：单次下载任务超时时间为 5 分钟
- **私密配置**：所有密码和密钥都通过 Secrets 安全存储

## 🐛 故障排查

### API 返回 404
- Space 可能还在构建或重启中
- 等待 2-3 分钟后重试

### 下载失败
- 检查 GEM_EMAIL 和 GEM_PASS 是否正确
- 检查 geminigen.ai 账号是否正常
- 查看 API 返回的 stderr 输出

### S3 上传失败
- 检查 S3_ACCESS_KEY 和 S3_SECRET_KEY
- 确认 S3 bucket 是否可访问

## 📊 监控日志

可以在 Space 页面查看实时日志，了解下载任务的执行情况。

---

**Space 地址:** https://huggingface.co/spaces/tndai/geminigen-hf
