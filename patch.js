// ============================================================
// 记忆表格远程导入补丁
// ============================================================

function getPluginBaseUrl() {
    // 1. 优先从已加载的脚本标签中查找
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
        const src = script.src;
        if (src.includes('st-memory-enhancement') && /\.js$/.test(src)) {
            const match = src.match(/^(.*\/)[^/]+\.js/);
            if (match) {
                console.log('[补丁] ✅ 通过脚本标签找到插件路径:', match[1]);
                return match[1];
            }
        }
    }

    // 2. 如果脚本标签找不到，回退到固定路径
    const origin = window.location.origin;
    const fallbackPaths = [
        origin + '/data/default-user/extensions/st-memory-enhancement/',
        origin + '/public/scripts/extensions/third-party/st-memory-enhancement/'
    ];

    for (const path of fallbackPaths) {
        console.log('[补丁] 尝试回退路径:', path);
        // 直接返回路径，让后续 import 去尝试加载
        // 如果路径错误，import 会抛出异常，由上层 catch 处理
        return path;
    }

    throw new Error('无法找到记忆表格插件路径');
}

async function applyPatch() {
    console.log('[补丁] 等待记忆表格插件加载...');
    let attempts = 0;
    while (typeof window.stMemoryEnhancement === 'undefined') {
        if (attempts > 30) {
            console.error('[补丁] 记忆表格插件加载超时');
            toastr.error('记忆表格插件加载超时，请刷新页面重试', '补丁加载');
            return;
        }
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    console.log('[补丁] 插件已加载，正在注入远程导入功能...');

    let baseUrl;
    try {
        baseUrl = getPluginBaseUrl();
        console.log('[补丁] 最终使用路径:', baseUrl);
    } catch (err) {
        console.error('[补丁] 路径探测失败:', err.message);
        toastr.error('路径探测失败，请确认记忆表格插件已安装', '补丁加载');
        return;
    }

    try {
        // 测试路径是否有效
        const testModule = await import(baseUrl + 'index.js');
        console.log('[补丁] ✅ 路径验证成功，index.js 可加载');

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

        window.stMemoryEnhancement.ext_importTablesFromUrl = async function(url) {
            try {
                console.log(`[远程导入] 从 ${url} 获取预设...`);
                const response = await fetch(url, { cache: 'no-cache' });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const importedData = await response.json();

                if (!importedData || typeof importedData !== 'object') {
                    throw new Error('预设数据格式无效');
                }

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

                if (Array.isArray(importedData)) {
                    const { piece: currentPiece } = USER.getChatPiece();
                    if (!currentPiece) throw new Error('无法获取当前聊天片段');
                    const newSheets = convertOldTablesToNewSheets(importedData, currentPiece);
                    USER.saveChat();
                    await updateSheetsView();
                    toastr.success(`成功导入 ${newSheets.length} 个表格`, '记忆增强');
                    return { success: true };
                }

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

        window.stMemoryEnhancement.updateSystemMessageTableStatus = updateSystemMessageTableStatus;

        console.log('✅ [补丁] 远程导入功能已成功注入！');
        toastr.success('记忆表格远程导入补丁已生效', '补丁加载');
    } catch (err) {
        console.error('[补丁] 注入失败:', err);
        toastr.error('远程导入补丁加载失败: ' + err.message, '补丁加载');
    }
}

applyPatch();