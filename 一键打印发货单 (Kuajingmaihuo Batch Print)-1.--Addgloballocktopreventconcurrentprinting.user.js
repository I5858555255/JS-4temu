// ==UserScript==
// @name         一键打印发货单 (Kuajingmaihuo Batch Print)
// @namespace    http://tampermonkey.net/
// @version      1.4 // Add global lock to prevent concurrent printing
// @description  Prevents script from running twice. Collects items, verifies, then prints.
// @author       You
// @match        https://seller.kuajingmaihuo.com/main/order-manager/shipping-list
// @match        https://seller.kuajingmaihuo.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        window.location.reload
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // --- Robust Singleton Lock ---
    const SCRIPT_INSTANCE_ID = Date.now() + Math.random();
    if (window.KJM_PRINTER_INSTANCE_ID) {
        console.log(`KJM Printer: Another instance (${window.KJM_PRINTER_INSTANCE_ID}) is active. New instance ${SCRIPT_INSTANCE_ID} is halting.`);
        return;
    }
    window.KJM_PRINTER_INSTANCE_ID = SCRIPT_INSTANCE_ID;
    console.log(`KJM Printer: Instance ${SCRIPT_INSTANCE_ID} is now active.`);

    function releaseScriptLock() {
        console.log(`KJM Printer: Releasing lock for instance ${SCRIPT_INSTANCE_ID}.`);
        window.KJM_PRINTER_INSTANCE_ID = null;
    }

    // --- Global Print Lock ---
    let isPrintingInProgress = false;

    // --- Configuration ---
    const PRINTER_API_URL = 'http://127.0.0.1:8080/print';
    const DELAY_AFTER_CLICK = 1000;
    const DELAY_AFTER_PRINT_API = 500;
    const DELAY_AFTER_CLOSE = 500;
    const DELAY_BETWEEN_ORDERS = 1000;
    const MAX_CLOSE_ATTEMPTS = 5;
    const CLOSE_ATTEMPT_DELAY = 200;

    // --- Main Function ---
    function main() {
        console.log('Tampermonkey script loaded for kuajingmaihuo.');
        setupGlobalTriggers();

        const observer = new MutationObserver((mutationsList, observer) => {
            for(const mutation of mutationsList) {
                if (mutation.type === 'childList') {
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === 1) {
                            const detailsDrawer = node.querySelector ? node.querySelector('div.index-module__drawer-body___3-jUp') : null;
                            if (detailsDrawer) {
                                console.log('Details drawer opened, adding print button.');
                                addSinglePrintButton(detailsDrawer);
                            }
                        }
                    }
                }
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        const currentOrderIndex = GM_getValue('currentOrderIndex', -1);
        if (currentOrderIndex !== -1) {
            console.log(`Resuming batch print from index ${currentOrderIndex}...`);
            alert(`检测到未完成的批量打印任务，将从第 ${currentOrderIndex + 1} 个订单开始继续.\n如需重新开始，请按 Shift+F4 重置。`);
            setTimeout(() => processNextOrder(currentOrderIndex), 1000);
        }
    }

    // --- Helper Functions ---

    function setupGlobalTriggers() {
        console.log('Setting up global key listeners for printing.');
        document.addEventListener('keydown', function(e) {
            if (e.key === 'F4' && !e.shiftKey && !e.ctrlKey && !e.altKey) {
                e.preventDefault();
                handleOneClickPrint();
            }
            if (e.key === 'F4' && e.shiftKey) {
                e.preventDefault();
                GM_setValue('currentOrderIndex', -1);
                releaseScriptLock(); // Release the lock on reset
                console.log('Shift+F4 pressed. Batch print progress reset.');
                alert('批量打印进度已重置。页面将刷新。');
                window.location.reload();
            }
        });

        const hint = document.createElement('div');
        hint.innerHTML = '<b>打印助手:</b> 按 <b>F4</b> 开始批量打印, 按 <b>Shift+F4</b> 重置.';
        hint.id = 'print-hint';
        document.body.appendChild(hint);

        GM_addStyle(`
            #print-hint { position: fixed; top: 40px; right: 10px; padding: 10px; background: rgba(255, 255, 255, 0.9); border: 1px solid #ccc; border-radius: 5px; box-shadow: 0 2px 5px rgba(0,0,0,0.2); font-size: 12px; color: #333; z-index: 9998; }
        `);
    }

    function addSinglePrintButton(drawerElement) {
        const buttonId = 'singlePagePrintButton';
        if (drawerElement.querySelector(`#${buttonId}`)) return;
        const button = document.createElement('button');
        button.textContent = '打印当前页';
        button.id = buttonId;

        button.addEventListener('click', async () => {
            button.disabled = true;
            button.textContent = '正在打印...';
            const printedCount = await collectAndPrintFromDrawer(drawerElement);
            button.textContent = printedCount > 0 ? `打印成功 (${printedCount})` : '打印失败';
            setTimeout(() => { button.textContent = '打印当前页'; button.disabled = false; }, 2500);
        });

        drawerElement.style.position = 'relative';
        drawerElement.appendChild(button);
        console.log('Single page print button added.');

        GM_addStyle(`
            #${buttonId} { position: absolute; top: 15px; right: 60px; padding: 8px 12px; background-color: #28a745; color: white; border: none; border-radius: 5px; cursor: pointer; font-size: 14px; z-index: 10000; }
            #${buttonId}:hover { background-color: #218838; }
            #${buttonId}:disabled { background-color: #6c757d; cursor: not-allowed; }
        `);
    }

    async function handleOneClickPrint() {
        const currentOrderIndex = GM_getValue('currentOrderIndex', -1);
        if (currentOrderIndex !== -1) {
            alert(`批量打印已在进行中 (当前在第 ${currentOrderIndex + 1} 个订单)。\n如需重置，请按 Shift+F4。`);
            return;
        }
        console.log('Starting batch print from the beginning.');
        GM_setValue('currentOrderIndex', 0);
        processNextOrder(0);
    }

    async function processNextOrder(index) {
        const orderRowSelector = 'tr[data-testid="beast-core-table-body-tr"]';
        const orderRows = document.querySelectorAll(orderRowSelector);

        if (index >= orderRows.length) {
            console.log('All order rows processed. Batch print complete!');
            GM_setValue('currentOrderIndex', -1);
            releaseScriptLock(); // Release the lock on completion
            return;
        }

        console.log(`Processing order row ${index + 1} of ${orderRows.length}...`);
        const orderRow = orderRows[index];

        try {
            const detailsButton = Array.from(orderRow.querySelectorAll('a[data-testid="beast-core-button-link"]')).find(btn => btn.textContent.includes('包裹详情'));
            if (!detailsButton) {
                console.error(`Package details button not found for order row ${index + 1}. Skipping.`);
                GM_setValue('currentOrderIndex', index + 1);
                setTimeout(() => processNextOrder(index + 1), DELAY_BETWEEN_ORDERS);
                return;
            }

            console.log('Clicking package details button...');
            detailsButton.click();
            await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_CLICK));

            const detailsDrawer = document.querySelector('div.index-module__drawer-body___3-jUp');
            if (!detailsDrawer) {
                console.error('Could not find the package details drawer. Skipping.');
                await closeDetailsDrawer();
                GM_setValue('currentOrderIndex', index + 1);
                setTimeout(() => processNextOrder(index + 1), DELAY_BETWEEN_ORDERS);
                return;
            }

            addSinglePrintButton(detailsDrawer);
            const printedItemsCount = await collectAndPrintFromDrawer(detailsDrawer, index + 1);

            if (printedItemsCount > 0) {
                console.log(`Successfully sent ${printedItemsCount} individual print job(s) for order ${index + 1}.`);
            } else {
                console.warn(`No items were printed for order ${index + 1}.`);
            }

            if (!await closeDetailsDrawer()) {
                console.error(`Failed to close drawer for order ${index + 1}. Reloading to continue.`);
                window.location.reload();
                return;
            }
            await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_CLOSE));

            GM_setValue('currentOrderIndex', index + 1);
            setTimeout(() => processNextOrder(index + 1), DELAY_BETWEEN_ORDERS);

        } catch (error) {
            console.error(`Error processing order row ${index + 1}:`, error);
            if (!await closeDetailsDrawer()) {
                console.error(`Failed to close drawer on error for order ${index + 1}. Reloading.`);
                window.location.reload();
                return;
            }
            GM_setValue('currentOrderIndex', index + 1);
            setTimeout(() => processNextOrder(index + 1), DELAY_BETWEEN_ORDERS);
        }
    }

    async function collectAndPrintFromDrawer(drawerElement, orderIndex = 'current') {
        if (isPrintingInProgress) {
            console.log(`A print job is already in progress. Skipping duplicate call for order ${orderIndex}.`);
            return 0;
        }
        if (drawerElement.dataset.isPrinting === 'true') {
            console.log(`Print process for order ${orderIndex} has already been run. Skipping duplicate call.`);
            return 0;
        }

        isPrintingInProgress = true;
        drawerElement.dataset.isPrinting = 'true';
        console.log(`Lock acquired for printing order ${orderIndex}.`);

        try {
            console.log(`Collecting individual print tasks for order ${orderIndex}...`);
            const skuSelector = 'td:nth-child(1)';
            const quantitySelector = 'td:nth-child(3)';
            const detailsTableRows = drawerElement.querySelectorAll('tr[data-testid="beast-core-table-body-tr"]');
            const printTasks = [];

            for (const detailsRow of detailsTableRows) {
                const skuElement = detailsRow.querySelector(skuSelector);
                const quantityElement = detailsRow.querySelector(quantitySelector);
                let sku = skuElement ? skuElement.textContent.trim() : null;
                let quantity = null;

                if (quantityElement) {
                    const quantityMatch = quantityElement.textContent.trim().match(/\d+/);
                    if (quantityMatch) quantity = parseInt(quantityMatch[0], 10);
                }

                if (sku && quantity !== null) {
                    printTasks.push({ sku, quantity });
                } else {
                    console.warn(`Could not parse SKU or quantity for a row in order ${orderIndex}.`);
                }
            }

            if (printTasks.length !== detailsTableRows.length) {
                console.error(`Data verification failed for order ${orderIndex}. Found ${detailsTableRows.length} rows but parsed ${printTasks.length} tasks. Skipping print for this order.`);
                return 0;
            }

            if (printTasks.length === 0) {
                console.warn(`No valid items found to print for order ${orderIndex}.`);
                return 0;
            }

            console.log(`Verification successful. Found ${printTasks.length} tasks. Starting print...`);

            let printedJobsCount = 0;
            for (const task of printTasks) {
                try {
                    await callPrinterAPI(task.sku, task.quantity, orderIndex);
                    printedJobsCount++;
                    await new Promise(resolve => setTimeout(resolve, DELAY_AFTER_PRINT_API));
                } catch (apiError) {
                    console.error(`Failed to print task SKU ${task.sku} (Qty: ${task.quantity}) for order ${orderIndex}:`, apiError);
                }
            }
            return printedJobsCount;
        } finally {
            isPrintingInProgress = false;
            console.log(`Lock released for printing order ${orderIndex}.`);
        }
    }

    async function closeDetailsDrawer() {
        console.log('Attempting to close package details drawer...');
        let attempts = 0;
        const closeButtonSelector = 'div.Drawer_closeIcon_5-117-0';
        const visibleDrawerSelector = 'div.Drawer_outerWrapper_5-117-0.Drawer_right_5-117-0.Drawer_visible_5-117-0';

        while (attempts < MAX_CLOSE_ATTEMPTS) {
            const visibleDrawer = document.querySelector(visibleDrawerSelector);
            if (!visibleDrawer) {
                console.log('Drawer is already closed.');
                return true;
            }

            const closeButton = document.querySelector(closeButtonSelector);
            const targetElement = closeButton || visibleDrawer;

            if (targetElement) {
                const rect = targetElement.getBoundingClientRect();
                const x = rect.left + rect.width / 2;
                const y = rect.top + rect.height / 2;
                const mousedownEvent = new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y });
                targetElement.dispatchEvent(mousedownEvent);
                const mouseupEvent = new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y });
                targetElement.dispatchEvent(mouseupEvent);
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y });
                targetElement.dispatchEvent(clickEvent);
                console.log(`Simulated click to close drawer (attempt ${attempts + 1}).`);
            } else {
                console.warn(`Could not find target for closing drawer (attempt ${attempts + 1}).`);
            }

            await new Promise(resolve => setTimeout(resolve, CLOSE_ATTEMPT_DELAY));
            attempts++;
        }

        console.error(`Failed to close drawer after ${MAX_CLOSE_ATTEMPTS} attempts.`);
        return false;
    }

    async function callPrinterAPI(sku, quantity, orderIndex) {
        console.log(`Sending to printer: SKU ${sku}, Quantity ${quantity} (Order ${orderIndex})`);
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: PRINTER_API_URL,
                data: JSON.stringify({ sku, quantity }),
                headers: { "Content-Type": "application/json" },
                onload: response => {
                    if (response.status >= 200 && response.status < 300) {
                        console.log(`Successfully sent to printer (Order ${orderIndex}): ${response.responseText}`);
                        resolve(response);
                    } else {
                        console.error(`Printer API error (Order ${orderIndex}): ${response.status} - ${response.responseText}`);
                        reject(response);
                    }
                },
                onerror: response => {
                    console.error(`Printer API request failed (Order ${orderIndex}):`, response);
                    reject(response);
                }
            });
        });
    }

    function waitForElement(selector, callback, timeout = 30000) {
        const startTime = Date.now();
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval);
                callback();
            } else if (Date.now() - startTime > timeout) {
                clearInterval(interval);
                console.log(`[Kuajingmaihuo Batch Print] Timed out waiting for element: ${selector}`);
            }
        }, 500);
    }

    waitForElement('tr[data-testid="beast-core-table-body-tr"]', main);

})();