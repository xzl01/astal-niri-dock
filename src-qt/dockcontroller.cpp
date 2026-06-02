#include "dockcontroller.h"

#include <QCoreApplication>
#include <QDebug>
#include <QDir>
#include <QFile>
#include <QFileInfo>
#include <QJsonArray>
#include <QJsonDocument>
#include <QJsonObject>
#include <QProcess>
#include <QStandardPaths>
#include <QtGlobal>

namespace {

constexpr int DockHideTimeoutMs = 650;
constexpr int EdgeHideTimeoutMs = 260;
constexpr int NiriPollIntervalMs = 600;
constexpr int NiriCommandTimeoutMs = 1000;

QStringList defaultPinnedApps()
{
    return {
        QStringLiteral("firefox.desktop"),
        QStringLiteral("org.kde.dolphin.desktop"),
        QStringLiteral("code.desktop"),
        QStringLiteral("kitty.desktop"),
    };
}

qint64 jsonInteger(const QJsonObject &object, const QString &key, qint64 fallback = -1)
{
    const QJsonValue value = object.value(key);
    if (value.isDouble()) {
        return static_cast<qint64>(value.toDouble(fallback));
    }
    if (value.isString()) {
        bool ok = false;
        const qint64 parsed = value.toString().toLongLong(&ok);
        if (ok) {
            return parsed;
        }
    }
    return fallback;
}

bool jsonBool(const QJsonObject &object, const QStringList &keys)
{
    for (const QString &key : keys) {
        const QJsonValue value = object.value(key);
        if (value.isBool()) {
            return value.toBool();
        }
        if (value.isDouble()) {
            return value.toDouble() != 0.0;
        }
    }
    return false;
}

QString basename(const QString &path)
{
    return QFileInfo(path).fileName();
}

QString configPath()
{
    const QStringList candidates = {
        QDir::current().filePath(QStringLiteral("config.json")),
        QCoreApplication::applicationDirPath() + QStringLiteral("/config.json"),
        QDir::homePath() + QStringLiteral("/Dev/astal-niri-dock/config.json"),
    };

    for (const QString &candidate : candidates) {
        if (QFileInfo::exists(candidate)) {
            return candidate;
        }
    }
    return candidates.first();
}

QByteArray runNiriCommand(const QStringList &arguments, bool *ok, QString *error)
{
    *ok = false;

    const QString niri = QStandardPaths::findExecutable(QStringLiteral("niri"));
    if (niri.isEmpty()) {
        *error = QStringLiteral("niri is not installed or not in PATH");
        return {};
    }

    QProcess process;
    process.start(niri, arguments);
    if (!process.waitForStarted(NiriCommandTimeoutMs)) {
        *error = QStringLiteral("failed to start niri");
        return {};
    }

    if (!process.waitForFinished(NiriCommandTimeoutMs)) {
        process.kill();
        process.waitForFinished(100);
        *error = QStringLiteral("niri command timed out");
        return {};
    }

    if (process.exitStatus() != QProcess::NormalExit || process.exitCode() != 0) {
        *error = QString::fromUtf8(process.readAllStandardError()).trimmed();
        if (error->isEmpty()) {
            *error = QStringLiteral("niri command failed");
        }
        return {};
    }

    *ok = true;
    return process.readAllStandardOutput();
}

} // namespace

DockController::DockController(QObject *parent)
    : QObject(parent)
{
    m_pinnedIds = loadPinnedConfig();
    if (qEnvironmentVariableIsSet("ASTAL_NIRI_DOCK_VERIFY_VISIBLE")) {
        m_edgeActive = true;
        m_showDock = true;
    }

    m_edgeHideTimer.setSingleShot(true);
    m_edgeHideTimer.setInterval(EdgeHideTimeoutMs);
    connect(&m_edgeHideTimer, &QTimer::timeout, this, [this]() {
        m_edgeActive = false;
        updateShowDock();
    });

    m_dockHideTimer.setSingleShot(true);
    m_dockHideTimer.setInterval(DockHideTimeoutMs);
    connect(&m_dockHideTimer, &QTimer::timeout, this, [this]() {
        m_dockHovered = false;
        updateShowDock();
    });

    connect(&m_pollTimer, &QTimer::timeout, this, &DockController::pollNiri);
    m_pollTimer.setInterval(NiriPollIntervalMs);
    m_pollTimer.start();

    pollNiri();
    rebuildEntries();
}

QVariantList DockController::entries() const
{
    return m_entries;
}

bool DockController::showDock() const
{
    return m_showDock;
}

bool DockController::niriAvailable() const
{
    return m_niriAvailable;
}

QString DockController::statusText() const
{
    return m_statusText;
}

void DockController::activate(int index)
{
    if (index < 0 || index >= m_dockEntries.size()) {
        return;
    }

    const DockEntry &entry = m_dockEntries.at(index);
    if (!entry.windows.isEmpty()) {
        focusWindow(entry.windows.first().id);
        return;
    }

    m_appDatabase.launch(entry.app);
}

void DockController::edgeEntered()
{
    m_edgeHideTimer.stop();
    m_edgeActive = true;
    updateShowDock();
}

void DockController::edgeExited()
{
    m_edgeHideTimer.start();
}

void DockController::dockEntered()
{
    m_dockHideTimer.stop();
    m_dockHovered = true;
    updateShowDock();
}

void DockController::dockExited()
{
    m_dockHideTimer.start();
}

void DockController::reload()
{
    m_appDatabase.reload();
    m_pinnedIds = loadPinnedConfig();
    pollNiri();
    rebuildEntries();
}

void DockController::pollNiri()
{
    bool ok = false;
    qint64 focusedWindowId = -1;
    QString error;
    const QVector<NiriWindowInfo> windows = queryNiriWindows(&ok, &focusedWindowId, &error);

    setNiriAvailable(ok);
    setStatusText(ok ? QString{} : error);

    if (!ok) {
        if (!m_windows.isEmpty()) {
            m_windows.clear();
            rebuildEntries();
        }
        return;
    }

    m_windows = windows;
    if (focusedWindowId >= 0) {
        for (NiriWindowInfo &window : m_windows) {
            window.focused = window.focused || window.id == focusedWindowId;
        }
    }
    rebuildEntries();
}

void DockController::rebuildEntries()
{
    QVector<DockEntry> dockEntries;
    QVector<DesktopApp> pinnedApps;

    for (const QString &pinnedId : m_pinnedIds) {
        DesktopApp app = m_appDatabase.findApp(pinnedId);
        pinnedApps.append(app);

        DockEntry entry;
        entry.app = app;
        for (const NiriWindowInfo &window : m_windows) {
            if (m_appDatabase.matchAppId(app, window.appId)) {
                entry.windows.append(window);
                entry.focused = entry.focused || window.focused;
                entry.urgent = entry.urgent || window.urgent;
            }
        }
        dockEntries.append(entry);
    }

    QStringList seenUnpinnedAppIds;
    for (const NiriWindowInfo &window : m_windows) {
        if (window.appId.isEmpty()) {
            continue;
        }

        bool pinned = false;
        for (const DesktopApp &pinnedApp : pinnedApps) {
            if (m_appDatabase.matchAppId(pinnedApp, window.appId)) {
                pinned = true;
                break;
            }
        }
        if (pinned) {
            continue;
        }

        DesktopApp app = m_appDatabase.findApp(window.appId);
        const QString normalizedId = normalizeAppId(app.id);
        if (normalizedId.isEmpty() || seenUnpinnedAppIds.contains(normalizedId)) {
            continue;
        }
        seenUnpinnedAppIds.append(normalizedId);

        DockEntry entry;
        entry.app = app;
        for (const NiriWindowInfo &candidateWindow : m_windows) {
            if (m_appDatabase.matchAppId(app, candidateWindow.appId)) {
                entry.windows.append(candidateWindow);
                entry.focused = entry.focused || candidateWindow.focused;
                entry.urgent = entry.urgent || candidateWindow.urgent;
            }
        }
        dockEntries.append(entry);
    }

    QVariantList qmlEntries;
    for (const DockEntry &entry : dockEntries) {
        QStringList titles;
        for (const NiriWindowInfo &window : entry.windows) {
            if (!window.title.isEmpty()) {
                titles.append(window.title);
            }
        }

        QVariantMap map;
        map.insert(QStringLiteral("name"), entry.app.name);
        map.insert(QStringLiteral("appId"), entry.app.id);
        map.insert(QStringLiteral("iconName"), entry.app.iconName.isEmpty() ? QStringLiteral("application-x-executable") : entry.app.iconName);
        map.insert(QStringLiteral("running"), !entry.windows.isEmpty());
        map.insert(QStringLiteral("focused"), entry.focused);
        map.insert(QStringLiteral("urgent"), entry.urgent);
        map.insert(QStringLiteral("windowCount"), entry.windows.size());
        map.insert(QStringLiteral("tooltip"), titles.isEmpty() ? entry.app.name : QStringLiteral("%1: %2").arg(entry.app.name, titles.join(QStringLiteral(" / "))));
        qmlEntries.append(map);
    }

    m_dockEntries = dockEntries;
    if (m_entries != qmlEntries) {
        m_entries = qmlEntries;
        emit entriesChanged();
    }
}

void DockController::updateShowDock()
{
    const bool show = m_edgeActive || m_dockHovered;
    if (m_showDock == show) {
        return;
    }

    m_showDock = show;
    emit showDockChanged();
}

void DockController::setNiriAvailable(bool available)
{
    if (m_niriAvailable == available) {
        return;
    }

    m_niriAvailable = available;
    emit niriAvailableChanged();
}

void DockController::setStatusText(const QString &text)
{
    if (m_statusText == text) {
        return;
    }

    m_statusText = text;
    emit statusTextChanged();
}

QStringList DockController::loadPinnedConfig() const
{
    QFile file(configPath());
    if (!file.open(QIODevice::ReadOnly)) {
        qWarning("astal-niri-dock: failed to read %s", qPrintable(file.fileName()));
        return defaultPinnedApps();
    }

    const QJsonDocument document = QJsonDocument::fromJson(file.readAll());
    const QJsonArray pinned = document.object().value(QStringLiteral("pinned")).toArray();
    if (pinned.isEmpty()) {
        return defaultPinnedApps();
    }

    QStringList result;
    for (const QJsonValue value : pinned) {
        const QString appId = value.toString();
        if (!appId.isEmpty()) {
            result.append(appId);
        }
    }
    return result.isEmpty() ? defaultPinnedApps() : result;
}

QVector<DockController::NiriWindowInfo> DockController::queryNiriWindows(bool *ok, qint64 *focusedWindowId, QString *error) const
{
    *ok = false;
    *focusedWindowId = -1;

    if (qEnvironmentVariableIsEmpty("NIRI_SOCKET")) {
        *error = QStringLiteral("NIRI_SOCKET is not set; start from inside niri");
        return {};
    }

    bool windowsOk = false;
    const QByteArray windowsOutput = runNiriCommand({QStringLiteral("msg"), QStringLiteral("-j"), QStringLiteral("windows")}, &windowsOk, error);
    if (!windowsOk) {
        return {};
    }

    const QJsonDocument windowsDocument = QJsonDocument::fromJson(windowsOutput);
    if (!windowsDocument.isArray()) {
        *error = QStringLiteral("niri windows output is not an array");
        return {};
    }

    QVector<NiriWindowInfo> windows;
    const QJsonArray array = windowsDocument.array();
    windows.reserve(array.size());

    for (const QJsonValue value : array) {
        const QJsonObject object = value.toObject();
        NiriWindowInfo info;
        info.id = jsonInteger(object, QStringLiteral("id"));
        info.pid = jsonInteger(object, QStringLiteral("pid"));
        info.appId = object.value(QStringLiteral("app_id")).toString();
        if (info.appId.isEmpty()) {
            info.appId = object.value(QStringLiteral("appId")).toString();
        }
        if (info.appId.isEmpty()) {
            info.appId = object.value(QStringLiteral("wm_class")).toString();
        }
        if (info.appId.isEmpty()) {
            info.appId = object.value(QStringLiteral("wmClass")).toString();
        }
        if (info.appId.isEmpty()) {
            info.appId = processNameForPid(info.pid);
        }
        info.title = object.value(QStringLiteral("title")).toString();
        info.focused = jsonBool(object, {QStringLiteral("is_focused"), QStringLiteral("isFocused"), QStringLiteral("focused")});
        info.urgent = jsonBool(object, {QStringLiteral("is_urgent"), QStringLiteral("isUrgent"), QStringLiteral("urgent")});

        if (info.id >= 0) {
            windows.append(info);
        }
    }

    bool focusOk = false;
    QString focusError;
    const QByteArray focusOutput = runNiriCommand({QStringLiteral("msg"), QStringLiteral("-j"), QStringLiteral("focused-window")}, &focusOk, &focusError);
    if (focusOk) {
        const QJsonDocument focusDocument = QJsonDocument::fromJson(focusOutput);
        if (focusDocument.isObject()) {
            *focusedWindowId = jsonInteger(focusDocument.object(), QStringLiteral("id"));
        }
    }

    *ok = true;
    return windows;
}

bool DockController::focusWindow(qint64 id) const
{
    if (id < 0) {
        return false;
    }

    bool ok = false;
    QString error;
    runNiriCommand({QStringLiteral("msg"), QStringLiteral("action"), QStringLiteral("focus-window"), QStringLiteral("--id"), QString::number(id)}, &ok, &error);
    if (!ok) {
        qWarning("astal-niri-dock: failed to focus niri window %lld: %s", static_cast<long long>(id), qPrintable(error));
    }
    return ok;
}

QString DockController::processNameForPid(qint64 pid)
{
    if (pid <= 0) {
        return {};
    }

    const QFileInfo exeInfo(QStringLiteral("/proc/%1/exe").arg(pid));
    const QString target = exeInfo.symLinkTarget();
    if (!target.isEmpty()) {
        return basename(target);
    }

    QFile cmdline(QStringLiteral("/proc/%1/cmdline").arg(pid));
    if (!cmdline.open(QIODevice::ReadOnly)) {
        return {};
    }

    const QByteArray data = cmdline.readAll();
    const qsizetype nul = data.indexOf('\0');
    const QByteArray command = nul >= 0 ? data.left(nul) : data;
    return basename(QString::fromLocal8Bit(command));
}
