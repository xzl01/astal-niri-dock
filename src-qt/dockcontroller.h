#pragma once

#include "desktopappdatabase.h"

#include <QObject>
#include <QTimer>
#include <QVariantList>

class DockController : public QObject {
    Q_OBJECT
    Q_PROPERTY(QVariantList entries READ entries NOTIFY entriesChanged)
    Q_PROPERTY(bool showDock READ showDock NOTIFY showDockChanged)
    Q_PROPERTY(bool niriAvailable READ niriAvailable NOTIFY niriAvailableChanged)
    Q_PROPERTY(QString statusText READ statusText NOTIFY statusTextChanged)

public:
    explicit DockController(QObject *parent = nullptr);

    QVariantList entries() const;
    bool showDock() const;
    bool niriAvailable() const;
    QString statusText() const;

    Q_INVOKABLE void activate(int index);
    Q_INVOKABLE void edgeEntered();
    Q_INVOKABLE void edgeExited();
    Q_INVOKABLE void dockEntered();
    Q_INVOKABLE void dockExited();
    Q_INVOKABLE void reload();

signals:
    void entriesChanged();
    void showDockChanged();
    void niriAvailableChanged();
    void statusTextChanged();

private:
    struct NiriWindowInfo {
        qint64 id = -1;
        qint64 pid = -1;
        QString appId;
        QString title;
        bool focused = false;
        bool urgent = false;
    };

    struct DockEntry {
        DesktopApp app;
        QVector<NiriWindowInfo> windows;
        bool focused = false;
        bool urgent = false;
    };

    void pollNiri();
    void rebuildEntries();
    void updateShowDock();
    void setNiriAvailable(bool available);
    void setStatusText(const QString &text);
    QStringList loadPinnedConfig() const;
    QVector<NiriWindowInfo> queryNiriWindows(bool *ok, qint64 *focusedWindowId, QString *error) const;
    bool focusWindow(qint64 id) const;

    static QString processNameForPid(qint64 pid);

    DesktopAppDatabase m_appDatabase;
    QStringList m_pinnedIds;
    QVector<NiriWindowInfo> m_windows;
    QVector<DockEntry> m_dockEntries;
    QVariantList m_entries;

    QTimer m_pollTimer;
    QTimer m_edgeHideTimer;
    QTimer m_dockHideTimer;
    bool m_edgeActive = false;
    bool m_dockHovered = false;
    bool m_showDock = false;
    bool m_niriAvailable = false;
    QString m_statusText;
};
