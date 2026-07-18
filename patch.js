// ============================================================
// 记忆表格远程导入补丁（基于官方API）
// ============================================================

(async function main() {
    console.log('[补丁] 脚本已加载，等待APP_READY...');

    // 等待酒馆核心就绪
    const appReady = new Promise(resolve => {
        if (typeof SillyTavern !== 'undefined' && SillyTavern.eventSource) {
            SillyTavern.eventSource.once('app_ready', resolve);
        } else {
            // 如果SillyTavern尚未定义，轮询检查
            const check = setInterval(() => {
                if (typeof SillyTavern !== 'undefined' && SillyTavern.eventSource) {
                    clearInterval(check);
                    SillyTavern.eventSource.once('app_ready', resolve);
                }
            }, 300);
        }
    });
    await appReady;

    const context = SillyTavern.getContext();
    console.log('[补丁] 酒馆核心已就绪');

    // 等待记忆表格插件API暴露
    let attempts = 0;
    while (typeof window.stMemoryEnhancement === 'undefined') {
        if (attempts > 30) {
            console.error('[补丁] 记忆表格插件加载超时');
            toastr.error('记忆表格插件加载超时，请刷新页面', '补丁加载');
            return;
        }
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    console.log('[补丁] 记忆表格插件API已就绪');

    // ---------- 智能路径探测 ----------
    function extractBaseFromScript() {
        const scripts = document.querySelectorAll('script[src]');
        for (const script of scripts) {
            const src = script.src;
            if (src.includes('st-memory-enhancement') && /index\.js$/.test(src)) {
                const base = src.substring(0, src.lastIndexOf('/') + 1);
                console.log('[补丁] ✅ 从脚本标签提取路径:', base);
                return base;
            }
        }
        return null;
    }

    async function probePaths() {
        const origin = window.location.origin;
        // 按可能性排序的候选路径（相对根目录）
        const candidates = [
            '/data/default-user/extensions/st-memory-enhancement/',
            '/extensions/st-memory-enhancement/',
            '/public/scripts/extensions/third-party/st-memory-enhancement/',
            '/scripts/extensions/third-party/st-memory-enhancement/',
            '/plugins/st-memory-enhancement/'
        ];

        for (const relPath of candidates) {
            const fullUrl = origin + relPath + 'index.js';
            try {
                const resp = await fetch(fullUrl, { method: 'HEAD' });
                if (resp.ok) {
                    console.log(`[补丁] ✅ 探测到有效路径: ${origin + relPath}`);
                    return origin + relPath;
                } else {
                    console.log(`[补丁] 路径 ${relPath} 状态码: ${resp.status}`);
                }
            } catch (e) {
                console.log(`[补丁] 路径 ${relPath} 请求失败:`, e.message);
            }
        }
        return null;
    }

    let baseUrl = extractBaseFromScript();
    if (!baseUrl) {
        console.log('[补丁] 未从脚本提取到路径，开始探测...');
        baseUrl = await probePaths();
    }

    if (!baseUrl) {
        console.error('[补丁] 所有路径探测均失败');
        toastr.error('找不到记忆表格插件路径，请确认已安装', '补丁加载');
        return;
    }

    console.log(`[补丁] 最终使用路径: ${baseUrl}`);

    // ---------- 动态导入核心模块 ----------
    try {
        const userExt = await import(baseUrl + 'scripts/settings/userExtensionSetting.js');
        const indexModule = await import(baseUrl + 'index.js');

        const {
            renderSetting,
            initTableStructureToTemplate,
            refreshRebuildTemplate,
            updateSystemMessageTableStatus
        } = userExt;

        const {
            updateSheetsView,
            USER,
            BASE,
            buildSheetsByTemplates,
            convertOldTablesToNewSheets
        } = indexModule;

        // ---------- 注入远程导入函数 ----------
        window.stMemoryEnhancement.ext_importTablesFromUrl = async function(url) {
            try {
                console.log(`[远程导入] 从 ${url} 获取预设...`);
                const response = await fetch(url, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const importedData = await response.json();

                if (!importedData || typeof importedData !== 'object') {
                    throw new Error('预设数据格式无效');
                }

                // 纯表格数据
                if (importedData.hash_sheets) {
                    const { piece: currentPiece } = USER.getChatPiece();
                    if (!currentPiece) throw new Error('无法获取当前聊天片段');
                    if (!currentPiece.hash_sheets) currentPiece.hash_sheets = {};
                    Object.assign(currentPiece.hash_sheets, importedData.hash_sheets);
                    USER.saveChat();
                    await updateSheetsView();
                    toastr.success('表格数据导入成功！', '记忆增强');
                    return { success: true };
                }

                // 旧表格数组
                if (Array.isArray(importedData)) {
                    const { piece: currentPiece } = USER.getChatPiece();
                    if (!currentPiece) throw new Error('无法获取当前聊天片段');
                    const newSheets = convertOldTablesToNewSheets(importedData, currentPiece);
                    USER.saveChat();
                    await updateSheetsView();
                    toastr.success(`成功导入 ${newSheets.length} 个表格`, '记忆增强');
                    return { success: true };
                }

                // 完整配置包（tableStructure）
                if (importedData.tableStructure) {
                    for (let key in importedData) {
                        USER.tableBaseSetting[key] = importedData[key];
                    }
                    USER.saveSettings();

                    renderSetting();
                    initTableStructureToTemplate();
                    refreshRebuildTemplate();
                    BASE.refreshTempView(false);

                    try {
                        const { piece } = USER.getChatPiece() || {};
                        if (piece) {
                            const chatArr = USER.getContext()?.chat || [];
                            let isSheetEmpty = true;
                            for (let i = chatArr.length - 1; i >= 0; i--) {
                                if (chatArr[i]?.hash_sheets) {
                                    for (const sheet_id in chatArr[i].hash_sheets) {
                                        if (chatArr[i].hash_sheets[sheet_id].length > 1) {
                                            isSheetEmpty = false;
                                            break;
                                        }
                                    }
                                    break;
                                }
                            }
                            if (isSheetEmpty) {
                                BASE.sheetsData.context = {};
                                for (const msg of chatArr) {
                                    if (msg?.hash_sheets) delete msg.hash_sheets;
                                }
                                buildSheetsByTemplates(piece);
                                BASE.refreshContextView();
                                BASE.refreshTempView(true);
                                updateSystemMessageTableStatus?.();
                            }
                        }
                    } catch (e) {
                        console.warn('[远程导入] 覆盖 chat 域时出错:', e);
                    }

                    await updateSheetsView();
                    updateSystemMessageTableStatus?.();

                    toastr.success('完整预设导入成功！所有设置和表格已更新', '记忆增强');
                    return { success: true };
                }

                throw new Error('预设数据格式不支持');
            } catch (error) {
                console.error('[远程导入] 失败:', error);
                toastr.error('远程预设导入失败: ' + error.message, '记忆增强');
                throw error;
            }
        };

        // 暴露辅助函数（可选）
        window.stMemoryEnhancement.updateSystemMessageTableStatus = updateSystemMessageTableStatus;

        console.log('✅ [补丁] 远程导入功能已成功注入！');
        toastr.success('记忆表格远程导入补丁已生效', '补丁加载');
    } catch (err) {
        console.error('[补丁] 注入失败:', err);
        toastr.error('远程导入补丁加载失败: ' + err.message, '补丁加载');
    }
})();