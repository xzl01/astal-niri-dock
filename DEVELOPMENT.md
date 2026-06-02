# astal-niri-dock 开发说明

这个项目是一个面向 niri 的 AGS / Astal GTK4 Dock 原型。它的重点不是做通用桌面环境 Dock，而是先把 niri 下的 layer-shell、窗口识别、自动隐藏和点击聚焦跑通。

## 项目结构

```text
astal-niri-dock/
├── config.json          # 固定应用列表
├── package.json         # AGS/TypeScript 脚本
├── scripts/
│   ├── check.sh         # 静态检查
│   ├── debug.sh         # 运行时诊断
│   ├── start.sh         # 启动 Dock
│   └── stop.sh          # 停止 Dock
└── src/
    ├── app.tsx          # AGS 入口、UI、自动隐藏、窗口绑定
    ├── app-info.ts      # .desktop 查询和应用匹配
    ├── config.ts        # config.json 加载
    ├── niri.ts          # AstalNiri / niri IPC 辅助函数
    └── style.css        # Dock 视觉样式
```

## 运行入口

开发时优先使用脚本：

```sh
cd ~/Dev/astal-niri-dock
./scripts/start.sh
```

`start.sh` 会做两件检查：

1. `ags` 是否在 `PATH` 里
2. `NIRI_SOCKET` 是否存在

检查通过后执行：

```sh
ags run --gtk 4 ./src/app.tsx
```

AGS 这里必须使用 GTK4。不要去掉 `--gtk 4`。

## 运行时窗口

`src/app.tsx` 里 `app.start()` 会创建两个 overlay window：

| namespace | 作用 |
| --- | --- |
| `astal-niri-dock` | Dock 主体 |
| `astal-niri-dock-sensor` | 底部 2px 边缘触发区 |

预期 `niri msg layers` 能看到：

```text
Overlay layer:
  Surface:
    Namespace: "astal-niri-dock"

  Surface:
    Namespace: "astal-niri-dock-sensor"
```

如果看不到这两个 surface，先检查 Dock 是否启动、`NIRI_SOCKET` 是否存在，以及是否有旧实例残留。

## 自动隐藏逻辑

自动隐藏逻辑在 `src/app.tsx`：

```text
dockTrigger  # 鼠标进入底部 sensor 后为 true
dockHovered  # 鼠标停留在 Dock 本体时为 true
showDock = dockTrigger || dockHovered
```

两个时间常量：

```ts
const DOCK_HIDE_TIMEOUT = 650
const EDGE_HIDE_TIMEOUT = 260
```

CSS 里的 `.DockBarContainer.slide-out` 负责真正的隐藏动画：

```css
.DockBarContainer.slide-out {
  opacity: 0;
  transform: translateY(86px) scale(0.94);
}
```

改自动隐藏行为时，先看 `EdgeSensor`、`Dock` 组件和这两个 timeout，不要直接从 CSS 硬改状态。

## 数据流

Dock 条目由两类来源组成：

1. `config.json` 里的固定应用
2. niri 当前窗口列表里的运行应用
3. `config.json` 里的天气摘要和天气弹窗数据

核心流程：

```text
config.json
  -> loadConfig()
  -> pinnedApps

AstalNiri windows
  -> windowAppId()
  -> findApp() / matchAppId()
  -> DockEntry[]
  -> DockItem
```

`DockEntry` 在 `src/app.tsx` 里定义：

```ts
type DockEntry = {
  appInfo: AppInfo
  windows: NiriWindow[]
  focused: boolean
}
```

点击 `DockItem` 时：

- 如果这个条目有窗口，focus 第一个窗口
- 如果没有窗口，调用 desktop entry 的 launch

## 应用识别规则

应用识别分两层：

- `src/niri.ts` 从窗口拿应用身份
- `src/app-info.ts` 把应用身份映射到 `.desktop`

### `windowAppId()` 的优先级

当前识别链是：

```text
AstalNiri window.appId / app_id
  -> niri msg -j windows 里同 id 窗口的 app_id
  -> wmClass / wm_class
  -> /proc/<pid>/exe basename
  -> /proc/<pid>/cmdline basename
```

这么做是为了处理飞书这类 `app_id` 为空的应用。

niri IPC 里飞书窗口类似：

```json
{
  "title": "飞书",
  "app_id": "",
  "pid": 819857
}
```

AstalNiri 的 `Window` 对象不暴露 `pid`，所以不能直接读 `window.pid`。当 `app-id` 为空时，代码会用 `window.id` 调 `niri msg -j windows` 找回原始窗口 JSON，再从 JSON 里拿 `pid`。

### 不要用 title 做身份识别

`title` 只能用于 tooltip 或显示窗口名，不要用来匹配 `.desktop`。

原因很简单：窗口标题会随着网页、文档、聊天内容变化。用它做身份识别会带来误匹配。

`src/app-info.ts` 当前刻意避免：

- title matching
- substring matching
- fuzzy matching

匹配 `.desktop` 时优先比较这些稳定字段：

```text
app_id
app_id.desktop
StartupWMClass
Exec basename
```

## `.desktop` 查询

`src/app-info.ts` 使用 `AstalApps`：

```ts
const applications = new Apps.Apps({
  nameMultiplier: 2,
  entryMultiplier: 2,
  executableMultiplier: 2,
})
```

导出的主要函数：

- `findApp(id: string): AppInfo`
- `matchAppId(app: AppInfo, appIdOrClass: string): boolean`

`findApp()` 找不到 desktop entry 时会返回一个 fallback `AppInfo`，图标用 `application-x-executable`，点击时只打印错误，不会崩溃。

## Niri focus 回退链

窗口聚焦逻辑在 `src/niri.ts` 的 `focusWindow()`。

当前顺序：

```text
window.focus(id)
  -> AstalNiri.msg.focus_window(id)
  -> niri msg action focus-window --id <id>
```

保留这三层回退是有意的。AstalNiri 的 API 和类型绑定可能变化，CLI fallback 可以保证个人桌面工具继续可用。

## 样式入口

所有视觉样式在 `src/style.css`。

主要类名：

| 类名 | 作用 |
| --- | --- |
| `window.DockWindow` | Dock 主窗口背景 |
| `.DockBarContainer` | Dock 外层容器和隐藏动画 |
| `.DockBar` | 玻璃背景、圆角、阴影 |
| `.DockItemBox` | 单个图标外层 |
| `.DockItem` | 图标按钮样式 |
| `.DockItem.focused` | 当前焦点应用 |
| `.DockItem.urgent` | urgent 应用 |
| `.DockIcon` | 图标阴影 |
| `.RunningDot` | 运行状态小点 |
| `.RunningDot.focused` | 当前焦点应用的长条指示器 |
| `.EdgeSensorFill` | 底部触发区 |

常用尺寸：

- Dock window 高度：`96`
- edge sensor 高度：`2`
- Dock item：`52px`
- icon pixel size：`38`
- focused running dot 宽度：`18px`

## 配置固定应用

编辑 `config.json`：

```json
{
  "pinned": [
    "firefox.desktop",
    "org.kde.dolphin.desktop",
    "code.desktop",
    "kitty.desktop"
  ]
}
```

## 天气组件

当前 AGS 版本先实现左侧状态槽和天气，不实现文件夹 stack。

天气数据来自 `config.json` 的 `weather` 字段：

- Dock 左侧是 `StatusDockItem`，点击可在 `status.task` 和 `weather` 两种状态之间切换。
- 任务状态显示图标、任务标题、副标题和静态进度条。
- 天气状态显示天气图标、温度、天气和温度范围。
- 鼠标进入天气状态或点击切换到天气状态时显示 `astal-niri-dock-weather` popup。
- popup 使用独立 overlay layer window，避免受 Dock 主窗口 96px 高度限制。
- 鼠标从左侧状态槽移动到 popup 时共享同一个隐藏 timer，减少闪烁。
- 数据是静态配置；后续如需实时天气或真实 agent 状态，再接 API 和缓存。

文件夹网格弹窗暂不做。

配置文件路径目前写死在 `src/config.ts`：

```ts
const path = `${GLib.get_home_dir()}/Dev/astal-niri-dock/config.json`
```

如果后续要安装成系统服务或迁移目录，这里应该改成 XDG config 路径。

## 常用命令

```sh
cd ~/Dev/astal-niri-dock

# 静态检查
./scripts/check.sh

# 启动
./scripts/start.sh

# 停止
./scripts/stop.sh

# 打印运行时状态
./scripts/debug.sh
```

`debug.sh` 会输出：

- `ags list`
- `niri msg layers`
- `niri msg -j windows`
- `niri msg -j focused-window`
- `/tmp/astal-niri-dock.log`

## 验证 checklist

改完代码后至少跑：

```sh
./scripts/check.sh
./scripts/stop.sh
./scripts/start.sh
./scripts/debug.sh
```

重点看：

1. `check.sh` 是否输出 `astal-niri-dock: static checks passed`
2. `niri msg layers` 是否有 `astal-niri-dock` 和 `astal-niri-dock-sensor`
3. `niri msg -j windows` 里新开的应用是否有合理的 `app_id` / `pid`
4. Dock 是否显示 pinned app 和运行中 app
5. 点击运行中 app 是否能 focus 对应窗口
6. urgent 应用是否出现 `.urgent` 样式

## 当前 caveats

- 必须在 niri 会话内运行，依赖 `NIRI_SOCKET`。
- 必须用 `ags run --gtk 4`。
- `AstalNiri.Window` 不暴露 `pid`，需要通过 `niri msg -j windows` 补字段。
- `windowJsonCache` 当前缓存 500ms，减少频繁 shell 调用，但仍然不是长期最优方案。
- `config.json` 路径写死，不适合打包安装。
- 没有 autostart 配置。
- `scripts/check.sh` 里的 `tsc --noEmit || true` 不会阻断 TypeScript 错误，后续如果类型环境稳定，应该改成失败即退出。
- 当前应用匹配比较保守，避免误识别。代价是某些没有稳定 `app_id` / `StartupWMClass` / `Exec` 关系的应用可能显示成 fallback 图标。

## 修改建议

- 改 UI：优先改 `src/style.css`，不要动 Niri 逻辑。
- 改自动隐藏：看 `Dock`、`EdgeSensor` 和两个 timeout。
- 改应用识别：先用 `./scripts/debug.sh` 看真实 `niri msg -j windows`，不要直接加 title/fuzzy matching。
- 改固定应用：优先改 `config.json`。
- 改启动方式：看 `scripts/start.sh`，不要在代码里加 autostart。
