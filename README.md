# 🧩 记忆表格远程导入补丁

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![GitHub release](https://img.shields.io/badge/release-v1.0.0-brightgreen.svg)](https://github.com/KinSakura/table-remote-importer/releases)

为 SillyTavern 的 **[记忆增强表格插件](https://github.com/muyoou/st-memory-enhancement)** 增加 **远程导入预设** 功能的补丁插件。  
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
```

如果输出`function` ，说明补丁安装成功 ✅

---

## 📖 使用方法

### API 说明

安装补丁后，记忆表格插件新增一个方法：

```javascript
window.stMemoryEnhancement.ext_importTablesFromUrl(url)
```

| 参数 | 类型 | 说明 |
|------|------|------|
| `url` | `string` | 预设 JSON 文件的完整 URL |

**返回值**：`Promise<{ success: boolean }>`

### 基础用法

```javascript
// 从远程 URL 导入表格预设
window.stMemoryEnhancement.ext_importTablesFromUrl('https://your-server.com/preset.json')
    .then(result => {
        if (result.success) {
            console.log('✅ 导入成功');
        }
    })
    .catch(error => {
        console.error('❌ 导入失败:', error);
    });
```

### 酒馆助手一键导入脚本

将以下代码保存为酒馆助手脚本，创建按钮即可一键更新：

```javascript
// ========== 配置 ==========
const TABLE_URL = 'https://your-server.com/preset.json';

// ========== 导入函数 ==========
async function importTable() {
    if (typeof window.stMemoryEnhancement?.ext_importTablesFromUrl !== 'function') {
        toastr.error('补丁插件未安装，请先安装 table-remote-importer');
        return;
    }

    try {
        toastr.info('正在导入记忆表格预设...');
        await window.stMemoryEnhancement.ext_importTablesFromUrl(TABLE_URL);
        toastr.success('✅ 记忆表格预设导入成功！');
    } catch (err) {
        toastr.error('导入失败: ' + err.message);
        console.error(err);
    }
}

// ========== 创建按钮 ==========
replaceScriptButtons([{ name: '📥 更新记忆表格', visible: true }]);
eventOn(getButtonEvent('📥 更新记忆表格'), importTable);
```

### 批量导入脚本（含酒馆预设 + 世界书）

```javascript
// ========== 配置 ==========
const TABLE_URL = 'https://your-server.com/table_preset.json';
const PRESET_URL = 'https://your-server.com/tavern_preset.json';
const PRESET_NAME = '我的远程预设';
const WORLD_BOOKS = ['我的世界书'];

// ========== 导入函数 ==========
async function importAll() {
    const tablePlugin = window.stMemoryEnhancement;
    
    // 1. 导入记忆表格
    if (typeof tablePlugin?.ext_importTablesFromUrl === 'function') {
        await tablePlugin.ext_importTablesFromUrl(TABLE_URL);
        toastr.success('记忆表格导入成功');
    }

    // 2. 导入酒馆预设
    if (typeof TavernHelper !== 'undefined') {
        const resp = await fetch(PRESET_URL);
        await TavernHelper.importRawPreset(PRESET_NAME, await resp.text());
        toastr.success('酒馆预设导入成功');
    }

    // 3. 启用世界书
    if (WORLD_BOOKS.length && typeof TavernHelper !== 'undefined') {
        const current = await TavernHelper.getGlobalWorldbookNames();
        const merged = [...new Set([...current, ...WORLD_BOOKS])];
        await TavernHelper.rebindGlobalWorldbooks(merged);
        toastr.success('世界书已启用');
    }

    toastr.success('✅ 全部更新完成！');
}

// ========== 创建按钮 ==========
replaceScriptButtons([{ name: '🔄 一键更新全部', visible: true }]);
eventOn(getButtonEvent('🔄 一键更新全部'), importAll);
```

---

## 📄 预设文件格式要求

远程 JSON 文件必须符合记忆表格插件的预设格式，支持以下三种：

### 格式一：完整配置包（推荐）

包含 `tableStructure` 字段：

```json
{
  "injection_mode": "injection_off",
  "deep": 1,
  "message_template": "...",
  "tableStructure": [...]
}
```

### 格式二：纯表格数据

包含 `hash_sheets` 字段：

```json
{
  "hash_sheets": {
    "uid1": [["值1", "值2"], ["值3", "值4"]]
  }
}
```

### 格式三：旧表格数组

兼容旧版表格格式：

```json
[
  {
    "tableName": "角色信息",
    "columns": ["属性", "值"],
    "content": [["姓名", "张三"]]
  }
]
```

> **建议**：先通过记忆表格插件界面手动导出一个预设作为模板。

---

## ❓ 常见问题

**Q：导入后表格没变化？**

A：检查以下几点：
1. 确认 URL 可访问（直接在浏览器打开 JSON 链接）
2. 检查控制台是否有错误信息
3. 确认 JSON 格式符合要求

**Q：补丁插件和记忆表格插件更新会冲突吗？**

A：不会。补丁只新增 API，不修改任何源文件。记忆表格更新后，只要内部函数名不变，补丁依然有效。

**Q：如何更新补丁插件？**

A：在扩展管理面板中点击"更新"按钮，或重新从 URL 安装。

**Q：国内用户访问 GitHub 慢怎么办？**

A：推荐使用 Gitee 源：`https://gitee.com/victorgggg/table-remote-importer`

---

## 📌 相关链接

| 项目 | 链接 |
|------|------|
| 补丁插件（GitHub） | https://github.com/KinSakura/table-remote-importer |
| 补丁插件（Gitee） | https://gitee.com/victorgggg/table-remote-importer |
| 记忆增强表格插件 | https://github.com/muyoou/st-memory-enhancement |
| SillyTavern 官网 | https://sillytavern.app |

---

## 📄 许可证

MIT License

---

## 🙏 致谢

- 记忆增强表格插件作者 [muyoou](https://gitee.com/muyoou)
- SillyTavern 社区
