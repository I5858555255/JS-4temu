// ==UserScript==
// @name         Auto Click Script
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  自动点击脚本
// @author       You
// @match        https://csp.aliexpress.com/m_apps/aechoice-product-bidding/biddingRegistration*
// @grant        GM_addStyle
// @grant        GM_addElement
// ==/UserScript==

(function() {
    'use strict';

    // 添加控制面板到页面
    function addControlPanel() {
        const panel = document.createElement('div');
        panel.id = 'autoClickPanel';
        panel.style.position = 'fixed';
        panel.style.top = '10px';
        panel.style.right = '10px';
        panel.style.zIndex = '1000';
        panel.style.backgroundColor = 'white';
        panel.style.padding = '10px';
        panel.style.border = '1px solid #ccc';
        panel.style.borderRadius = '5px';

        // 添加最低值设置输入框
        const minValueInput = document.createElement('input');
        minValueInput.id = 'customInputValue';
        minValueInput.type = 'number';
        minValueInput.step = '0.1';
        minValueInput.placeholder = '设置最低值';
        minValueInput.style.marginRight = '5px';

        // 添加开关按钮
        const switchButton = document.createElement('button');
        switchButton.id = 'autoClickSwitch';
        switchButton.textContent = '开启定时提交';
        switchButton.style.margin = '0 5px';
        switchButton.style.padding = '5px 10px';
        switchButton.style.backgroundColor = 'red'; // 初始状态为红色
        switchButton.style.color = 'white';
        switchButton.style.border = 'none';
        switchButton.style.borderRadius = '3px';
        switchButton.style.cursor = 'pointer';

        // 添加系统时间显示
        const timeDisplay = document.createElement('div');
        timeDisplay.id = 'systemTime';
        timeDisplay.style.marginTop = '5px';

        panel.appendChild(minValueInput);

        // === 新增：时间选择器 ===
        const timeContainer = document.createElement('div');
        timeContainer.style.margin = '10px 0';
        timeContainer.style.display = 'flex';
        timeContainer.style.flexWrap = 'wrap';

        // 创建小时选择器
        const hourSelect = createTimeSelect('hour', 0, 23);
        hourSelect.style.marginRight = '5px';

        // 创建分钟选择器
        const minSelect = createTimeSelect('minute', 0, 59);
        minSelect.style.marginRight = '5px';

        // 创建秒钟选择器
        const secSelect = createTimeSelect('second', 0, 59);
        secSelect.style.marginRight = '10px';

        // 修改: 设置默认时间为当前系统时间加10秒
        const now = new Date();
        now.setSeconds(now.getSeconds() + 10); // 当前时间+10秒
        hourSelect.value = now.getHours();
        minSelect.value = now.getMinutes();
        secSelect.value = now.getSeconds();

        // 添加元素到容器
        timeContainer.appendChild(hourSelect);
        timeContainer.appendChild(minSelect);
        timeContainer.appendChild(secSelect);
        panel.appendChild(timeContainer);
        // === 结束新增 ===

        // +++ 修复：添加完整的三个延时参数设置 +++
        // 1. 检查间隔延时设置
        const checkDelayContainer = document.createElement('div');
        checkDelayContainer.style.margin = '10px 0';

        const checkDelayLabel = document.createElement('label');
        checkDelayLabel.textContent = '检查间隔(ms): ';
        checkDelayLabel.style.marginRight = '5px';

        const checkDelayInput = document.createElement('input');
        checkDelayInput.id = 'checkDelayInput';
        checkDelayInput.type = 'number';
        checkDelayInput.value = '500';  // 默认值500毫秒
        checkDelayInput.style.width = '80px';

        checkDelayContainer.appendChild(checkDelayLabel);
        checkDelayContainer.appendChild(checkDelayInput);
        panel.appendChild(checkDelayContainer);

        // 2. 重新提交间隔延时设置
        const resubmitDelayContainer = document.createElement('div');
        resubmitDelayContainer.style.margin = '10px 0';

        const resubmitDelayLabel = document.createElement('label');
        resubmitDelayLabel.textContent = '重新提交间隔(ms): ';
        resubmitDelayLabel.style.marginRight = '5px';

        const resubmitDelayInput = document.createElement('input');
        resubmitDelayInput.id = 'resubmitDelayInput';
        resubmitDelayInput.type = 'number';
        resubmitDelayInput.value = '500';  // 默认值500毫秒
        resubmitDelayInput.style.width = '80px';

        resubmitDelayContainer.appendChild(resubmitDelayLabel);
        resubmitDelayContainer.appendChild(resubmitDelayInput);
        panel.appendChild(resubmitDelayContainer);

        // 3. 结果检查延时设置 (已存在)
        const resultDelayContainer = document.createElement('div');
        resultDelayContainer.style.margin = '10px 0';

        const resultDelayLabel = document.createElement('label');
        resultDelayLabel.textContent = '结果检查延时(ms): ';
        resultDelayLabel.style.marginRight = '5px';

        const resultDelayInput = document.createElement('input');
        resultDelayInput.id = 'resultCheckDelayInput';
        resultDelayInput.type = 'number';
        resultDelayInput.value = '1500';  // 默认值1500毫秒
        resultDelayInput.style.width = '80px';

        resultDelayContainer.appendChild(resultDelayLabel);
        resultDelayContainer.appendChild(resultDelayInput);
        panel.appendChild(resultDelayContainer);
        // +++ 结束修复 +++

        // +++ 新增：添加自动减0.1开关 +++
        const reduceContainer = document.createElement('div');
        reduceContainer.style.margin = '10px 0';

        const reduceLabel = document.createElement('label');
        reduceLabel.textContent = '自动减0.1: ';
        reduceLabel.style.marginRight = '5px';

        const reduceCheckbox = document.createElement('input');
        reduceCheckbox.type = 'checkbox';
        reduceCheckbox.id = 'reduceCheckbox';
        reduceCheckbox.checked = true; // 默认开启
        reduceCheckbox.style.marginRight = '5px';

        reduceContainer.appendChild(reduceLabel);
        reduceContainer.appendChild(reduceCheckbox);
        panel.appendChild(reduceContainer);
        // +++ 结束新增 +++

        panel.appendChild(switchButton);
        panel.appendChild(timeDisplay);
        document.body.appendChild(panel);

        // 更新系统时间显示
        function updateSystemTime() {
            const now = new Date();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');
            timeDisplay.textContent = `系统时间: ${hours}:${minutes}:${seconds}`;
        }

        setInterval(updateSystemTime, 1000);
        updateSystemTime();
    }

    // === 新增：创建时间选择下拉框 ===
    function createTimeSelect(id, min, max) {
        const select = document.createElement('select');
        select.id = `time-${id}`;
        select.style.padding = '5px';

        for (let i = min; i <= max; i++) {
            const option = document.createElement('option');
            option.value = i;
            option.textContent = String(i).padStart(2, '0');
            select.appendChild(option);
        }
        return select;
    }

    // === 新增：设置当前时间 ===
    function setCurrentTime(hourSelect, minSelect, secSelect) {
        const now = new Date();
        hourSelect.value = now.getHours();
        minSelect.value = now.getMinutes();
        secSelect.value = now.getSeconds();
    }

    // 检查提交是否成功的函数
    function checkSubmitSuccess() {
        // 修改：使用实际的成功模态框选择器
        const successIndicator = document.querySelector('div[aria-modal="true"][aria-labelledby^="dialog-title-"]');
        return successIndicator !== null;
    }

    // 主自动点击逻辑
    function startAutoClick(targetInputSelector) {
        const minValue = parseFloat(document.getElementById('customInputValue').value) || 0;
        const targetInput = document.querySelector(targetInputSelector);
        const submitButton = document.querySelector('button[name="submit"][type="button"].next-btn.next-medium.next-btn-primary');
        const switchButton = document.getElementById('autoClickSwitch');

        if (!targetInput || !submitButton) {
            alert('未找到目标元素！');
            return;
        }

        const originalValue = parseFloat(targetInput.value);
        let currentValue = originalValue;
        let isRunning = true;
        // 新增：获取自动减0.1开关状态
        const reduceEnabled = document.getElementById('reduceCheckbox').checked;

        // === 修复：正确获取三个延时参数 ===
        const checkDelay = parseInt(document.getElementById('checkDelayInput').value) || 500;
        const resubmitDelay = parseInt(document.getElementById('resubmitDelayInput').value) || 500;
        const resultCheckDelay = parseInt(document.getElementById('resultCheckDelayInput').value) || 1500;
        // === 结束修复 ===

        // === 新增：存储定时器ID ===
        let checkTimer = null;
        let processTimer = null;

        const processSubmission = () => {
            if (!isRunning) return;

            // 提交操作
            submitButton.click();

            // 检查提交结果
            processTimer = setTimeout(() => {
                if (checkSubmitSuccess()) {
                    // 提交成功：停止脚本并切换按钮状态
                    isRunning = false;
                    switchButton.textContent = '开启定时提交';
                    switchButton.style.backgroundColor = 'red';
                    alert('提交成功！');
                } else {
                    // 修改：根据开关状态决定是否减少数值
                    if (reduceEnabled) {
                        currentValue = parseFloat((currentValue - 0.1).toFixed(1));
                    }

                    if (currentValue < minValue) {
                        // 达到最低值：停止脚本
                        isRunning = false;
                        switchButton.textContent = '开启定时提交';
                        switchButton.style.backgroundColor = 'red';
                        alert('已达最低值，停止脚本');
                    } else {
                        // 更新数值并继续提交
                        // 聚焦输入框确保激活状态
                        targetInput.focus();

                        // 使用框架级赋值方法（优先尝试触发响应式更新）
                        try {
                            const inputPrototype = Object.getPrototypeOf(targetInput);
                            const descriptor = Object.getOwnPropertyDescriptor(inputPrototype, 'value');
                            if (descriptor && descriptor.set) {
                                descriptor.set.call(targetInput, currentValue);
                            } else {
                                targetInput.value = currentValue;
                            }
                        } catch (e) {
                            targetInput.value = currentValue;
                        }

                        // 分阶段触发事件确保DOM更新
                        setTimeout(() => {
                            // 触发标准事件
                            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
                            // 新增中文输入法兼容事件
                            targetInput.dispatchEvent(new Event('compositionend', { bubbles: true }));

                            // 继续提交流程
                            processTimer = setTimeout(processSubmission, resubmitDelay);
                        }, 50);
                    }
                }
            }, resultCheckDelay);
        };

        // 检查目标时间是否到达
        const checkTargetTime = () => {
            if (!isRunning) return;  // 新增停止检查

            const now = new Date();
            // 修改：使用选择的时间值
            const hour = parseInt(document.getElementById('time-hour').value);
            const minute = parseInt(document.getElementById('time-minute').value);
            const second = parseInt(document.getElementById('time-second').value);
            const targetTime = new Date(
                now.getFullYear(),
                now.getMonth(),
                now.getDate(),
                hour, minute, second
            );

            if (now >= targetTime) {
                processSubmission();
            } else {
                // === 修改：使用变量存储定时器 ===
                checkTimer = setTimeout(checkTargetTime, checkDelay); // 修改：使用用户设置的延时
            }
        };

        checkTargetTime();

        // === 新增：返回停止函数 ===
        return function stop() {
            isRunning = false;
            clearTimeout(checkTimer);
            clearTimeout(processTimer);
        };
    }

    // 主函数
    function main() {
        addControlPanel();

        const switchButton = document.getElementById('autoClickSwitch');
        // === 修改：替换为停止函数引用 ===
        let stopFunc = null;

        switchButton.addEventListener('click', function() {
            if (switchButton.style.backgroundColor === 'red') {
                // 开启状态
                switchButton.textContent = '停止定时提交';
                switchButton.style.backgroundColor = 'green';

                // === 修改：保存停止函数 ===
                stopFunc = startAutoClick('input[placeholder="请输入"][data-spm-anchor-id]');
            } else {
                // 停止状态
                switchButton.textContent = '开启定时提交';
                switchButton.style.backgroundColor = 'red';
                // === 修改：调用停止函数 ===
                if (stopFunc) {
                    stopFunc();
                    stopFunc = null;
                }
            }
        });
    }

    // 执行主函数
    window.addEventListener('load', main, false);
})();