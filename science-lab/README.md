# Protocol Worlds

可演化科学实验环境的项目展示页，以及四个浏览器交互实验：NGS 连接窗口、磁珠纯化、BCA 批次显色、共享设备联合实验室。

## 本地运行

从本仓库根目录运行：

```sh
uv run --no-project python -m http.server 8782 --bind 127.0.0.1
```

打开 `http://127.0.0.1:8782/science-lab/`。也可用标准 Python 的 `python -m http.server 8782`。无需 Node 构建、第三方 CDN 或 API key。

## 内容与交互

- `index.html`、`project.css`、`project.mjs`：项目首页、排程对照、场景入口和环境机制。
- `lab/`：实验工作台的静态白名单副本。实验引擎与规则沿用现有版本，品牌入口返回项目首页。
- `lab/replays.json`：8 份已保存的作者开发回放；不是模型 rollout。
- `lab/catalog.json`：265 条公开协议元数据，其中 24 条含静态代码节点索引。316 个接口目录 ID 尚未完全对齐。
- `lab/icons/LICENSE`：Lucide / Feather 图标许可。
- `assets/`：首屏概念配图、实验台实际截图，以及本地 Geist 字体和 OFL 许可。

首页按“简介、排程对照、实验入口、环境机制”组织。场景图标为 32–34px，机制图标为 36px，配合直接的动作说明。来源口径保留在本文与实验台“协议与回放”，首页不再显示来源区和页脚。浅色／深色默认跟随系统，也可在导航栏切换；选择仅保存在当前浏览器。手机采用单列布局，减少动效设置会关闭过渡动画。

首页时间轴读取两份已有联合实验回放。温控仪占用由 `ligate` 事件加 15 分钟、`incubate` 事件加 32 分钟重建，与当前演示契约一致。滑块只查看记录，不改变实时实验。两组均在 78 分钟提交；显色优先对照中 A 于第 42 分钟开始连接，超过 20 分钟窗口。

实验台开始后，墙钟时间按选择的比例推进实验。页面内切换场景或页签不会暂停；重新加载、返回项目首页或关闭页面会中断前端实例。已执行动作不可回滚。记录留在本浏览器，可导出 JSON，不上传到任何服务。

## GitHub Pages

本目录可原样放进任何静态站点的子路径。HTML、模块、JSON 和图标均用相对链接，入口为 `/science-lab/`，实验台为 `/science-lab/lab/`。不需要改变仓库根首页或新增构建工作流。

该目录是公开演示的完整发布范围。不要把作者数据库、私有评测轨迹、凭据、原始第三方协议程序或整个研究仓库一并上传。

## 数据来源与边界

来源入口：[Opentrons Protocol Library](https://library.opentrons.com/)。各实验所引用的原始规程及作者补充假设，见实验台“协议与回放”。这里只提供公开元数据、来源链接和代码节点位置，不转载完整第三方协议脚本。

演示的时间、资源、材料和评分规则在作者侧可查看，不用于正式隔离 Solver 测试。模拟失败表示未满足本演示契约，不能推断实际生物产率或模型能力。正式评测需要独立可信后端、隐藏评分和公开文件白名单。GitHub Pages 仅承载静态演示，不承载研究侧 stdio MCP 服务；可用浏览器的 WebMCP 能力是可选接口。

## 设计参考

本页自行编写 HTML/CSS/JS，没有直接复制模板代码或引入其依赖。信息组织参考：

- [Clarity](https://shikun.io/projects/clarity)：研究项目叙事与交互对照。
- [Academic Project Page Template](https://eliahuhorwitz.github.io/Academic-project-page-template/)：清晰的项目入口与研究展示。
- [Transformer Explainer](https://poloclub.github.io/transformer-explainer/)：把参数、中间过程、结果放在同一交互中。

工作台沿用本项目现有实现，图标来自 [Lucide](https://lucide.dev/license)，许可随静态文件保留。

字体使用 [Geist](https://github.com/vercel/geist-font)，本地分发并保留 `assets/fonts/OFL.txt`。首屏概念配图由 image_gen 生成，提示为“冷灰实验台上的透明微孔板、移液头、两只微量离心管与金属温控模块；少量 #5955cc 紫色液体，柔和侧光，高质量产品摄影，无文字、标签或 UI”。该图不表示实际设施或实验结果。`assets/workbench.jpg` 是本项目未开始实验时的工作台截图。
