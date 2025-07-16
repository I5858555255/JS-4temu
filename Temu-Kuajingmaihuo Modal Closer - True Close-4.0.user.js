// ==UserScript==
// @name         Temu/Kuajingmaihuo Modal Closer - True Close
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  按F2键启动/关闭，真正关闭而非隐藏beast-core-modal模态框
// @author       Lingma
// @match        https://agentseller-us.temu.com/*
// @match        https://agentseller.temu.com/*
// @match        https://seller.kuajingmaihuo.com/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // 防止重复初始化
    const SCRIPT_ID = '__TEMU_MODAL_CLOSER_V4__';
    if (window[SCRIPT_ID]) {
        console.log('[模态框关闭器] 已存在，跳过重复初始化');
        return;
    }
    window[SCRIPT_ID] = true;

    // 全局防止AFE_NPM_CONFIG重复初始化
    if (typeof window.AFE_NPM_CONFIG === 'undefined') {
        window.AFE_NPM_CONFIG = {};
    }

    // 脚本状态
    let isEnabled = false;
    let observer = null;

    // 目标选择器配置
    const targetSelectors = {
        // 模态框内容容器
        modalInner: '[data-testid="beast-core-modal-inner"]',
        // 关闭按钮 - 新增用户提供的关闭按钮选择器
        closeButton: '[data-testid="beast-core-modal-icon-close"], [data-testid="beast-core-icon-close"]',
        // 模态框遮罩层
        modalMask: '[data-testid="beast-core-modal-mask"]',
        // 整个模态框容器
        modalContainer: '[data-testid="beast-core-modal"]',
        // 新增自动点击序列的选择器
        expandButton: '[data-testid="beast-core-icon-down"]',
        resetButton: 'button[data-tracking-id="xqVOakOmzZvI1RvU"]',
        todayDateCell: 'div.RPR_cell_5-111-0.RPR_today_5-111-0[data-today="true"]',
        confirmButton: 'button.BTN_outerWrapper_5-111-0.BTN_primary_5-111-0.BTN_small_5-111-0',
        // 新增：日期范围选择器标识
        rangePicker: '[data-testid="beast-core-rangePicker"]'
    };

    // 日志函数
    function log(message, type = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        console.log(`[${timestamp}] [模态框关闭器] ${message}`);
    }

    // 检查元素是否可见
    function isElementVisible(element) {
        if (!element) return false;
        const style = window.getComputedStyle(element);
        return style.display !== 'none' &&
               style.visibility !== 'hidden' &&
               style.opacity !== '0' &&
               element.offsetParent !== null;
    }

    // 新增：验证元素是否在日期范围选择器内
    function isInRangePicker(element) {
        if (!element) return false;
        return element.closest(targetSelectors.rangePicker) !== null;
    }

    // 修改后的安全点击函数（增加位置验证）
    function safeClick(element, requireInRangePicker = false) {
        if (!element) return false;

        // 新增：验证元素位置
        if (requireInRangePicker && !isInRangePicker(element)) {
            log(`安全点击中止：元素不在日期范围选择器内`, 'warn');
            return false;
        }

        try {
            // 尝试直接点击
            if (typeof element.click === 'function') {
                element.click();
                return true;
            }

            // 派发鼠标事件作为备选方案
            const clickEvent = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                view: window
            });
            element.dispatchEvent(clickEvent);
            return true;
        } catch (e) {
            log(`安全点击失败: ${e.message}`, 'error');
            return false;
        }
    }

    // 检查是否存在排除条件
    function shouldSkipClosing() {
        const hasStoreSwitch = Array.from(document.querySelectorAll('*')).some(el => {
            const text = el.innerText || el.textContent || '';
            return text.includes('切换店铺');
        });

        const hasCloseButton = document.querySelector(targetSelectors.closeButton);

        if (hasStoreSwitch && hasCloseButton) {
            log('检测到"切换店铺"和关闭按钮同时存在，跳过自动关闭');
            return true;
        }

        return false;
    }

    // 尝试触发React/Vue的关闭事件
    function triggerCloseEvent(element) {
        // 查找React fiber节点
        const reactFiberKey = Object.keys(element).find(key =>
            key.startsWith('__reactInternalInstance') || key.startsWith('__reactFiber')
        );

        if (reactFiberKey && element[reactFiberKey]) {
            try {
                const fiber = element[reactFiberKey];
                // 尝试找到onClose或类似的props
                let currentFiber = fiber;
                while (currentFiber) {
                    if (currentFiber.memoizedProps) {
                        const props = currentFiber.memoizedProps;
                        if (typeof props.onClose === 'function') {
                            props.onClose();
                            return true;
                        }
                        if (typeof props.onCancel === 'function') {
                            props.onCancel();
                            return true;
                        }
                        if (typeof props.onDismiss === 'function') {
                            props.onDismiss();
                            return true;
                        }
                    }
                    currentFiber = currentFiber.return;
                }
            } catch (e) {
                log(`React事件触发失败: ${e.message}`);
            }
        }

        // 查找Vue实例
        if (element.__vue__) {
            try {
                const vueInstance = element.__vue__;
                if (typeof vueInstance.$emit === 'function') {
                    vueInstance.$emit('close');
                    return true;
                }
                if (typeof vueInstance.close === 'function') {
                    vueInstance.close();
                    return true;
                }
            } catch (e) {
                log(`Vue事件触发失败: ${e.message}`);
            }
        }

        return false;
    }

    // 真正关闭模态框的函数
    function trueCloseModal(modalElement) {
        let closed = false;

        // 方法1: 尝试触发框架级的关闭事件
        if (triggerCloseEvent(modalElement)) {
            log('通过框架事件成功关闭模态框');
            return true;
        }

        // 方法2: 查找并点击关闭按钮
        const closeButton = modalElement.querySelector(targetSelectors.closeButton);
        if (closeButton && isElementVisible(closeButton)) {
            try {
                // 多种点击方式
                const clickMethods = [
                    () => closeButton.click(),
                    () => closeButton.dispatchEvent(new MouseEvent('click', {
                        bubbles: true, cancelable: true, view: window
                    })),
                    () => closeButton.dispatchEvent(new MouseEvent('mousedown', {
                        bubbles: true, cancelable: true, view: window
                    })),
                    () => closeButton.dispatchEvent(new TouchEvent('touchstart', {
                        bubbles: true, cancelable: true
                    }))
                ];

                for (const method of clickMethods) {
                    try {
                        method();
                        // 检查模态框是否真的被关闭
                        setTimeout(() => {
                            if (!document.contains(modalElement) || !isElementVisible(modalElement)) {
                                log('通过关闭按钮成功关闭模态框');
                                closed = true;
                            }
                        }, 100);
                        if (closed) break;
                    } catch (e) {
                        continue;
                    }
                }
            } catch (e) {
                log(`关闭按钮点击失败: ${e.message}`);
            }
        }

        // 方法3: 尝试键盘ESC事件
        if (!closed) {
            const escapeEvents = [
                new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }),
                new KeyboardEvent('keyup', { key: 'Escape', keyCode: 27, bubbles: true }),
                new Event('escape', { bubbles: true })
            ];

            escapeEvents.forEach(event => {
                modalElement.dispatchEvent(event);
                document.dispatchEvent(event);
                window.dispatchEvent(event);
            });
        }

        // 方法4: 查找并触发其他可能的关闭按钮
        if (!closed) {
            const potentialCloseButtons = modalElement.querySelectorAll(
                'button, [role="button"], .close, .cancel, .dismiss, [aria-label*="close"], [aria-label*="关闭"]'
            );

            potentialCloseButtons.forEach(button => {
                const text = (button.textContent || button.innerText || button.title || button.ariaLabel || '').toLowerCase();
                const isCloseButton = text.includes('close') || text.includes('cancel') ||
                                    text.includes('关闭') || text.includes('取消') ||
                                    text.includes('dismiss') || text.includes('×') ||
                                    button.classList.contains('close') ||
                                    button.classList.contains('cancel');

                if (isCloseButton && isElementVisible(button)) {
                    try {
                        button.click();
                        log(`通过候选按钮关闭: ${text}`);
                    } catch (e) {
                        // 继续尝试下一个
                    }
                }
            });
        }

        // 方法5: 如果以上都失败，尝试从DOM中移除
        if (!closed) {
            try {
                // 查找最顶层的模态框容器
                let rootModal = modalElement;
                let parent = modalElement.parentElement;

                while (parent) {
                    if (parent.dataset.testid === 'beast-core-modal' ||
                        parent.classList.contains('modal') ||
                        parent.classList.contains('modal-root') ||
                        parseInt(parent.style.zIndex) > 1000) {
                        rootModal = parent;
                    }
                    parent = parent.parentElement;
                }

                // 先尝试优雅关闭
                rootModal.style.transition = 'opacity 0.3s ease';
                rootModal.style.opacity = '0';

                setTimeout(() => {
                    if (rootModal.parentNode) {
                        rootModal.remove();
                        log('通过DOM移除关闭了模态框');
                        closed = true;
                    }
                }, 300);

            } catch (e) {
                log(`DOM移除失败: ${e.message}`);
            }
        }

        return closed;
    }

    // 主要的关闭模态框函数
    function closeModals() {
        if (!isEnabled) return 0;

        if (shouldSkipClosing()) {
            return 0;
        }

        let closedCount = 0;
        const modals = document.querySelectorAll(targetSelectors.modalContainer + ', ' + targetSelectors.modalInner);

        modals.forEach((modal, index) => {
            if (isElementVisible(modal)) {
                log(`尝试关闭模态框 #${index + 1}`);
                if (trueCloseModal(modal)) {
                    closedCount++;
                }
            }
        });

        // 如果没有找到特定的模态框，尝试查找通用模态框
        if (closedCount === 0) {
            const genericModals = document.querySelectorAll('.modal, [role="dialog"], [aria-modal="true"]');
            genericModals.forEach((modal, index) => {
                if (isElementVisible(modal)) {
                    log(`尝试关闭通用模态框 #${index + 1}`);
                    if (trueCloseModal(modal)) {
                        closedCount++;
                    }
                }
            });
        }

        return closedCount;
    }

    // 处理DOM变化
    function handleMutations(mutations) {
        if (!isEnabled) return;

        let hasModalChanges = false;

        mutations.forEach(mutation => {
            if (mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const hasTargetModal =
                            node.querySelector && (
                                node.querySelector(targetSelectors.modalInner) ||
                                node.querySelector(targetSelectors.closeButton) ||
                                node.matches && (
                                    node.matches(targetSelectors.modalInner) ||
                                    node.matches(targetSelectors.closeButton) ||
                                    node.matches('[role="dialog"]') ||
                                    node.matches('[aria-modal="true"]')
                                )
                            );

                        if (hasTargetModal) {
                            hasModalChanges = true;
                            log('检测到新的模态框元素');
                        }
                    }
                });
            }
        });

        if (hasModalChanges) {
            setTimeout(() => {
                if (!shouldSkipClosing()) {
                    const closed = closeModals();
                    if (closed > 0) {
                        log(`自动关闭了 ${closed} 个模态框`);
                    }
                }
            }, 200);
        }
    }

    // 启动观察器
    function startObserver() {
        if (observer) {
            observer.disconnect();
        }

        observer = new MutationObserver(handleMutations);

        const startObserving = () => {
            if (document.body) {
                observer.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: false
                });
                log('DOM观察器已启动');
            } else {
                setTimeout(startObserving, 100);
            }
        };

        startObserving();
    }

    // 停止观察器
    function stopObserver() {
        if (observer) {
            observer.disconnect();
            observer = null;
            log('DOM观察器已停止');
        }
    }

    // 显示状态通知
    function showStatusNotification(enabled) {
        const oldNotification = document.getElementById('modal-closer-status');
        if (oldNotification) {
            oldNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'modal-closer-status';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${enabled ? '#4CAF50' : '#FF5722'};
            color: white;
            padding: 12px 24px;
            border-radius: 6px;
            z-index: 999999;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            transition: all 0.3s ease;
            border-left: 4px solid ${enabled ? '#2E7D32' : '#D32F2F'};
        `;
        notification.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 16px;">${enabled ? '✅' : '❌'}</span>
                <span>模态框真正关闭: ${enabled ? '已启用' : '已禁用'}</span>
            </div>
        `;

        const targetParent = document.body || document.documentElement;
        targetParent.appendChild(notification);

        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3500);
    }

    // 切换启用状态
    function toggleEnabled() {
        isEnabled = !isEnabled;

        if (isEnabled) {
            log('=== 模态框真正关闭已启用 ===');
            startObserver();

            setTimeout(() => {
                if (!shouldSkipClosing()) {
                    const closed = closeModals();
                    if (closed > 0) {
                        log(`启用时真正关闭了 ${closed} 个模态框`);
                    } else {
                        log('当前页面暂无需要关闭的模态框');
                    }
                }
            }, 100);
        } else {
            log('=== 模态框真正关闭已禁用 ===');
            stopObserver();
        }

        showStatusNotification(isEnabled);
    }

    // 等待函数
    function wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // 执行自动点击序列
    async function performAutoClickSequence() {
        log('开始执行自动点击序列');

        // 新增：先关闭可能存在的模态框
        log('检查并关闭可能存在的模态框');
        const closedCount = closeModals();
        if (closedCount > 0) {
            log(`已关闭 ${closedCount} 个模态框，等待页面稳定...`);
            await wait(1000); // 给页面足够时间响应关闭操作
        }

        // 0. 点击"待仓库收货"标签 - 修复选择器语法错误
        // 第一步：通过属性选择器查找
        let tabButton = document.querySelector('[data-testid="beast-core-tab-itemLabel"][title="待仓库收货"]');
        // 第二步：如果未找到，则遍历所有标签匹配文本内容
        if (!tabButton) {
            const allTabLabels = document.querySelectorAll('[data-testid="beast-core-tab-itemLabel"]');
            for (const label of allTabLabels) {
                if (label.textContent.includes('待仓库收货')) {
                    tabButton = label;
                    break;
                }
            }
        }

        if (tabButton) {
            log('找到待仓库收货标签，尝试安全点击');
            if (safeClick(tabButton)) {
                log('待仓库收货标签点击成功，等待页面加载...');

                // 创建MutationObserver监控页面变化
                const pageLoadObserver = new MutationObserver(() => {});
                pageLoadObserver.observe(document.body, {
                    childList: true,
                    subtree: true,
                    attributes: true
                });

                // 添加超时机制
                const timeout = 5000; // 最大等待5秒
                const startTime = Date.now();
                let isLoaded = false;

                // 修改：增强页面加载检测条件
                const checkPageLoaded = () => {
                    // 检查日期范围选择器是否出现
                    const rangePicker = document.querySelector(targetSelectors.rangePicker);
                    if (!rangePicker) return false;

                    // 检查展开按钮是否出现在日期选择器区域内
                    return rangePicker.querySelector(targetSelectors.expandButton) !== null;
                };

                // 首次检查
                if (checkPageLoaded()) {
                    isLoaded = true;
                } else {
                    // 轮询检查直到加载完成或超时
                    while (!isLoaded && Date.now() - startTime < timeout) {
                        await wait(200); // 每200ms检查一次
                        isLoaded = checkPageLoaded();
                    }
                }

                // 断开观察器
                pageLoadObserver.disconnect();

                // 新增：关闭可能弹出的新模态框
                if (isLoaded) {
                    log('页面加载完成，继续下一步操作');
                    // 检查并关闭新出现的模态框
                    const newModalClosed = closeModals();
                    if (newModalClosed > 0) {
                        log(`已关闭 ${newModalClosed} 个新模态框`);
                        await wait(500); // 等待模态框关闭动画
                    }
                } else {
                    log(`⚠️ 页面加载超时（${timeout}ms），继续执行后续步骤`, 'warn');
                }
            } else {
                log('待仓库收货标签点击失败');
            }
        } else {
            log('未找到待仓库收货标签，跳过');
        }

        // 修改：优化展开按钮定位 - 增加位置验证
        let expandButton = null;
        const rangePicker = document.querySelector(targetSelectors.rangePicker);
        if (rangePicker) {
            expandButton = rangePicker.querySelector(targetSelectors.expandButton);
        }

        if (expandButton) {
            log('找到展开按钮，尝试安全点击（带位置验证）');
            // 修改：调用带位置验证的安全点击
            if (safeClick(expandButton, true)) {  // 新增true参数要求位置验证
                log('展开按钮点击成功');
            } else {
                log('展开按钮点击失败或位置验证未通过');
            }
            await wait(500);
        } else {
            log('未找到展开按钮，跳过');
        }

        // 新增步骤：点击日期输入框激活日期选择器
        const dateInput = document.querySelector('[data-testid="beast-core-rangePicker-htmlInput"]');
        if (dateInput) {
            log('找到日期输入框，尝试安全点击');
            if (safeClick(dateInput)) {
                log('日期输入框点击成功，激活日期选择器');
            } else {
                log('日期输入框点击失败');
            }
            await wait(500);
        } else {
            log('未找到日期输入框，跳过');
        }

        // 2. 点击重置按钮 - 使用安全点击
        const resetButton = document.querySelector(targetSelectors.resetButton);
        if (resetButton) {
            log('找到重置按钮，尝试安全点击');
            if (safeClick(resetButton)) {
                log('重置按钮点击成功');
            }
            await wait(1000);
        } else {
            log('未找到重置按钮，跳过');
        }

        // 3. 双击选择今日日期（改为两次连续单击）
        const todayCell = document.querySelector(targetSelectors.todayDateCell);
        if (todayCell) {
            log('找到今日日期单元格，执行双击模拟');
            // 第一次单击
            if (safeClick(todayCell)) {
                log('第一次单击成功');
            }
            await wait(100); // 模拟双击间隔
            // 第二次单击
            if (safeClick(todayCell)) {
                log('第二次单击成功，完成双击模拟');
            }
            await wait(500);
        } else {
            log('未找到今日日期单元格，跳过');
        }

        // 4. 点击确认按钮 - 使用安全点击
        const confirmButton = document.querySelector(targetSelectors.confirmButton);
        if (confirmButton) {
            log('找到确认按钮，尝试安全点击');
            if (safeClick(confirmButton)) {
                log('确认按钮点击成功');
            }
            await wait(500);
        } else {
            log('未找到确认按钮，跳过');
        }

        // 5. 再次点击查询按钮 - 使用安全点击
        if (resetButton) {
            log('再次点击查询按钮');
            safeClick(resetButton);
        }

        log('自动点击序列完成');
    }

    // 键盘事件处理
    function handleKeydown(e) {
        if (e.key === 'F2') {
            e.preventDefault();
            e.stopPropagation();

            // 检查是否在目标页面
            const targetUrl = 'https://seller.kuajingmaihuo.com/main/order-manager/shipping-list';
            if (window.location.href.startsWith(targetUrl)) {
                log('在目标页面，执行自动点击序列');
                performAutoClickSequence();
            } else {
                // 不在目标页面则执行原有功能
                toggleEnabled();
            }
        }
    }

    // 初始化函数
    function initialize() {
        document.addEventListener('keydown', handleKeydown, true);

        window.addEventListener('focus', () => {
            document.addEventListener('keydown', handleKeydown, true);
        });

        log('=== 模态框真正关闭器初始化完成 ===');
        log('按 F2 键启用/禁用真正关闭功能');
        // 新增日志说明
        log('在 https://seller.kuajingmaihuo.com/main/order-manager/shipping-list 页面按F2将执行自动点击序列');
    }

    // 根据文档状态选择初始化时机
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        setTimeout(initialize, 50);
    }

    window.addEventListener('load', () => {
        log('页面完全加载完成，脚本就绪');

        setTimeout(() => {
            const modalCount = document.querySelectorAll(targetSelectors.modalInner + ', [role="dialog"], [aria-modal="true"]').length;
            if (modalCount > 0) {
                log(`⚠️  发现 ${modalCount} 个模态框，按 F2 启用真正关闭功能`);
            }
        }, 1000);
    });

})();