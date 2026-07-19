# 🧩 记忆表格远程导入补丁

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/badge/release-v1.0.0-brightgreen.svg)](https://github.com/KinSakura/table-remote-importer/releases)

为 SillyTavern 的 **记忆增强表格插件** (`st-memory-enhancement`) 增加 **远程导入预设** 功能的补丁插件。  
无需修改记忆表格插件源码，安装后即可通过一行代码从任意 URL 加载预设 JSON。

---

## ✨ 功能特性

- ✅ **零侵入**：不修改记忆表格插件任何源文件，仅通过动态导入扩展 API
- ✅ **一键安装**：通过 SillyTavern 扩展管理界面直接安装
- ✅ **远程加载**：支持从任何公开 URL（GitHub Gist、自建服务器等）加载预设
- ✅ **完整兼容**：支持记忆表格插件的所有预设格式
- ✅ **自动生效**：安装后无需额外配置，刷新页面即生效

---

## 📦 安装方法

### 方法一：通过 SillyTavern 扩展管理（推荐）

1. 打开 SillyTavern 网页
2. 点击顶部 **扩展管理**（Extensions）图标
3. 点击 **"从 URL 安装"** 或 **"Install from URL"**
4. 输入以下任一仓库地址：

   | 源 | 仓库地址 |
   |---|---|
   | 🇨🇳 **Gitee（国内推荐）** | `https://gitee.com/victorgggg/table-remote-importer` |
   | 🇺🇸 **GitHub（国际）** | `https://github.com/KinSakura/table-remote-importer` |

5. 点击 **安装**，等待完成
6. **刷新页面**，补丁自动生效

### 方法二：手动安装（备用）

将 `table-remote-importer` 文件夹放入以下任一目录：

- `public/scripts/extensions/third-party/`
- `data/default-user/extensions/`

文件夹内需包含：
- `manifest.json`
- `index.js`

---

## 🔧 验证安装

刷新页面后，打开浏览器控制台（F12），输入：

```javascript
console.log(window.stMemoryEnhancement.ext_importTablesFromUrl)
