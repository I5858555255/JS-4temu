# Temu/Kuajingmaihuo 打印助手

这是一个用于在 Temu/Kuajingmaihuo 平台上自动化打印的工具集。它由两部分组成：一个油猴脚本，用于在网页上触发打印操作；一个本地打印服务，用于接收打印请求并调用打印机。

## 功能

*   **批量打印**：在 Kuajingmaihuo 网站上，通过按 `F4` 键一键批量打印所有订单的发货单。
*   **关闭模态框**：在 Temu/Kuajingmaihuo 网站上，通过按 `F2` 键关闭烦人的模态框。
*   **打印管理**：提供一个图形化界面，用于管理打印机、查看打印历史、重新打印等。
*   **灵活配置**：可以通过 `printer_config.json` 文件配置打印机、PDF 文件夹路径等。

## 安装

1.  **安装油猴 (Tampermonkey)**：在你的浏览器中安装 [Tampermonkey](https://www.tampermonkey.net/) 扩展。
2.  **安装用户脚本**：
    *   将 `Temu-Kuajingmaihuo Modal Closer - True Close-4.0.user.js` 拖到 Tampermonkey 的“已安装脚本”页面进行安装。
    *   将 `一键打印发货单 (Kuajingmaihuo Batch Print)-1.--Addgloballocktopreventconcurrentprinting.user.js` 拖到 Tampermonkey 的“已安装脚本”页面进行安装。
3.  **安装 Python**：确保你已经安装了 Python 3.x。
4.  **安装依赖**：
    ```bash
    pip install PySide6 pymupdf
    ```
5.  **配置**：
    *   打开 `printer_config.json` 文件。
    *   将 `temuskupdf_folder` 和 `other_folder` 配置为你的 PDF 文件夹路径。
    *   在 `print_set.txt` 文件中，每行输入一个打印机名称。

## 使用

1.  **启动本地服务**：双击 `start_api_server.bat` 文件启动本地打印服务。
2.  **批量打印**：
    *   打开 Kuajingmaihuo 的发货单页面。
    *   按 `F4` 键开始批量打印。
    *   按 `Shift+F4` 键可以重置打印进度。
3.  **关闭模态框**：
    *   在 Temu/Kuajingmaihuo 网站上，按 `F2` 键可以启用/禁用关闭模态框的功能。
4.  **打印管理**：
    *   运行 `printer_manager.py` 文件可以打开打印管理界面。
    *   ```bash
      python printer_manager.py
      ```

## 文件说明

*   `Temu-Kuajingmaihuo Modal Closer - True Close-4.0.user.js`: 关闭模态框的油猴脚本。
*   `一键打印发货单 (Kuajingmaihuo Batch Print)-1.--Addgloballocktopreventconcurrentprinting.user.js`: 批量打印的油猴脚本。
*   `api_server.py`: 接收打印请求的本地 HTTP 服务器。
*   `local_printer_interface.py`: 调用打印机执行打印任务的接口。
*   `printer_manager.py`: 打印管理界面。
*   `printer_config.py`: 打印配置加载器。
*   `printer_config.json`: 打印配置文件。
*   `print_logger.py`: 打印日志记录器。
*   `start_api_server.bat`: 启动本地打印服务的批处理文件。
