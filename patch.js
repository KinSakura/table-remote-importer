import { getContext } from "../../extensions.js";

console.log('[补丁] 脚本已加载 (ES Module)');

const context = getContext();

async function waitForTablePlugin() {
    return new Promise((resolve) => {
        const check = () => {
            if (typeof window.stMemoryEnhancement !== 'undefined') {
                resolve();
                return;
            }
            setTimeout(check, 200);
        };
        check();
    });
}

function getTablePluginBaseUrl() {
    const scripts = document.querySelectorAll('script[src]');
    for (const script of scripts) {
        const src = script.src;
        if (src.includes('st-memory-enhancement') && src.includes('index.js')) {
            const baseUrl = src.substring(0, src.lastIndexOf('/') + 1);
            console.log('[补丁] 从脚本标签提取路径:', baseUrl);
            return baseUrl;
        }
    }
    throw new Error('无法从已加载脚本中找到记忆表格插件路径');
}

async function applyPatch() {
    console.log('[补丁] 等待记忆表格插件加载...');

    try {
        await waitForTablePlugin();
        console.log('[补丁] 记忆表格插件 API 已就绪');

        const baseUrl = getTablePluginBaseUrl();
        console.log('[补丁] 使用路径:', baseUrl);

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