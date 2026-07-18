// ============================================================
// 记忆表格远程导入补丁
// ============================================================

function getPluginBaseUrl() {
    const origin = window.location.origin;
    const paths = [
        origin + '/data/default-user/extensions/st-memory-enhancement/',
        origin + '/public/scripts/extensions/third-party/st-memory-enhancement/'
    ];
    for (const path of paths) {
        try {
            const xhr = new XMLHttpRequest();
            xhr.open('HEAD', path + 'index.js', false);
            xhr.send();
            if (xhr.status === 200) {
                console.log('[补丁] ✅ 找到插件路径:', path);
                return path;
            }
        } catch (_) {}
    }
    throw new Error('未找到记忆表格插件，请确认已安装并启用');
}

async function applyPatch() {
    console.log('[补丁] 等待记忆表格插件加载...');
    let attempts = 0;
    while (typeof window.stMemoryEnhancement === 'undefined') {
        if (attempts > 30) {
            console.error('[补丁] 记忆表格插件加载超时');
            return;
        }
        await new Promise(r => setTimeout(r, 300));
        attempts++;
    }
    console.log('[补丁] 插件已加载，正在注入远程导入功能...');

    let baseUrl;
    try {
        baseUrl = getPluginBaseUrl();
    } catch (err) {
        console.error('[补丁] 路径探测失败:', err.message);
        toastr.error('路径探测失败，请确认记忆表格插件已安装', '补丁加载');
        return;
    }

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