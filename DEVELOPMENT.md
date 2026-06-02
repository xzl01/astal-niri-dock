# astal-niri-dock 开发说明

这个项目现在的主线是 Qt6/QML niri Dock。旧的 Astal/AGS GTK4 原型仍保留在 `src/*.ts(x)`，用于对照迁移过来的视觉和行为，不再是启动入口。

## 项目结构

```text
astal-niri-dock/
├── CMakeLists.txt
├── config.json
├── qml/
│   └── Main.qml                 # Dock UI、动画、sensor
├── scripts/
│   ├── check.sh                 # JSON/shell 检查；有 Qt 时构建
│   ├── debug.sh                 # 运行时诊断
│   ├── start.sh                 # 构建并启动 Qt Dock
│   └── stop.sh                  # 停止 Qt Dock
├── src-qt/
│   ├── desktopappdatabase.*     # .desktop 查询、匹配、启动
│   ├── dockcontroller.*         # 配置、niri 轮询、自动隐藏、点击处理
│   ├── layershellbridge.*       # LayerShellQt overlay layer 配置
│   ├── main.cpp                 # Qt/QML 入口
│   └── themeiconprovider.*      # 主题图标 image provider
└── src/                         # legacy AGS 原型参考
```

## 迁移后的功能对应

| AGS 原型功能 | Qt/QML 实现 |
| --- | --- |
| `astal-niri-dock` overlay window | `LayerShellBridge::configureDock()` |
| `astal-niri-dock-sensor` bottom sensor | `LayerShellBridge::configureSensor()` + QML `HoverHandler` |
| `dockTrigger || dockHovered` 自动隐藏 | `DockController` 的 edge/dock hover 状态和两个 timer |
| pinned apps from `config.json` | `DockController::loadPinnedConfig()` |
| `AstalApps` desktop entry lookup | `DesktopAppDatabase` 手动解析 `.desktop` |
| `AstalNiri` windows binding | `niri msg -j windows` 轮询 |
| focused window fallback | `niri msg -j focused-window` |
| click-to-focus | `niri msg action focus-window --id <id>` |
| app id fallback via `/proc/<pid>` | `DockController::processNameForPid()` |
| glass CSS styling | `qml/Main.qml` 的 `Rectangle`/gradient/animation |

## 自动隐藏逻辑

常量在 `src-qt/dockcontroller.cpp`：

```cpp
constexpr int DockHideTimeoutMs = 650;
constexpr int EdgeHideTimeoutMs = 260;
```

状态流：

```text
edgeEntered -> edge active true
edgeExited  -> 260ms 后 edge active false
dockEntered -> dock hovered true
dockExited  -> 650ms 后 dock hovered false
showDock    -> edge active || dock hovered
```

QML 根据 `dockController.showDock` 播放进入/退出动画。退出动画完成后才隐藏 dock window，底部 sensor window 始终保持可见。

## 视觉参数

关键尺寸从 AGS 原型迁移到 `qml/Main.qml`：

- Dock window 高度：`96`
- edge sensor 高度：`6`
- Dock bar 最小宽度：`272`
- Dock item：`54px`
- icon pixel size：`38`
- focused running dot 宽度：`20px`
- 普通 running dot：`4px`

## 应用识别规则

不要用窗口标题做身份识别。标题只适合 tooltip。

当前匹配候选：

```text
desktop id
desktop id without .desktop
desktop file basename
StartupWMClass
Exec basename
```

niri 窗口身份 fallback：

```text
app_id
-> appId
-> wm_class / wmClass
-> /proc/<pid>/exe basename
-> /proc/<pid>/cmdline basename
```

## LayerShellQt

Qt Wayland 普通窗口不能完整替代 dock layer 行为。目标 niri 环境需要安装 LayerShellQt，这样两个 QML `Window` 才会成为 overlay layer surface，并使用以下 namespace：

```text
astal-niri-dock
astal-niri-dock-sensor
```

不要引入 Hyprland-only IPC 或 layer APIs。

启动脚本和 `LayerShellBridge::initialize()` 都会在未显式设置时使用：

```sh
QT_QPA_PLATFORM=wayland
```

否则 Qt 可能走不到 Wayland layer-shell integration。

## 常用命令

```sh
cd ~/Dev/astal-niri-dock

./scripts/check.sh
./scripts/stop.sh
./scripts/start.sh
./scripts/debug.sh
./scripts/verify-runtime.sh
```

Qt 版会把 Qt message handler 输出写入 `/tmp/astal-niri-dock.log`，`debug.sh` 会读取这个文件，和旧原型的诊断入口保持一致。

`verify-runtime.sh` 是目标 niri 环境里的端到端验证入口：它会停止旧实例、用 `ASTAL_NIRI_DOCK_VERIFY_VISIBLE=1` 构建并启动 Qt dock、等待两个 niri layer namespace、校验 `niri msg -j windows` JSON、检查 Qt 日志里是否有 critical/fatal，再自动停止 dock。这个环境变量只用于验证主 Dock layer 可观测，普通启动仍保持自动隐藏初始状态。

严格检查：

```sh
ASTAL_NIRI_DOCK_STRICT_CHECK=1 ./scripts/check.sh
```

## 验证 checklist

1. `./scripts/check.sh` 能完成 Qt 构建，或在非目标机器上明确报告缺少 Qt。
2. `./scripts/start.sh` 在 niri 会话里启动 `astal-niri-dock-qt`。
3. `niri msg layers` 出现 `astal-niri-dock` 和 `astal-niri-dock-sensor`。
4. Dock 显示 `config.json` 中 pinned apps。
5. 运行中的窗口显示 running dot。
6. 当前 focused 应用显示长条 focused indicator。
7. urgent 窗口显示 urgent 样式。
8. 点击运行中 app 能 focus 对应 niri window。
9. 点击未运行 pinned app 能通过 `.desktop` 启动。
10. 底部 sensor 触发显示，离开 dock 后自动隐藏。
11. `./scripts/verify-runtime.sh` 在目标 niri 环境里通过。

## 当前 caveats

- 必须在 niri 会话内完整验证，依赖 `NIRI_SOCKET`。
- 当前机器如果没有 Qt6/LayerShellQt 开发包，只能跑 JSON/shell 检查，不能证明运行时完成。
- `niri msg` 轮询间隔为 600ms，足够迁移原型功能，但不是长期最优 IPC 方案。
- 项目没有安装流程，也没有 autostart 配置。
