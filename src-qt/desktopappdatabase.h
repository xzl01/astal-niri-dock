#pragma once

#include <QString>
#include <QStringList>
#include <QVector>

struct DesktopApp {
    QString id;
    QString name;
    QString iconName;
    QString wmClass;
    QString executable;
    QString execLine;
    QString desktopPath;
    QStringList candidates;
    bool valid = false;
};

QString normalizeAppId(const QString &value);
QStringList appIdForms(const QString &value);

class DesktopAppDatabase {
public:
    DesktopAppDatabase();

    void reload();
    DesktopApp findApp(const QString &id) const;
    bool matchAppId(const DesktopApp &app, const QString &appIdOrClass) const;
    bool launch(const DesktopApp &app) const;

private:
    QVector<DesktopApp> m_apps;

    static QStringList desktopSearchDirs();
    static DesktopApp parseDesktopFile(const QString &path, const QString &baseDir);
    static QStringList appCandidates(const DesktopApp &app);
};
