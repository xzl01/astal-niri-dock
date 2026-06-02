#include "desktopappdatabase.h"

#include <QDir>
#include <QDirIterator>
#include <QDebug>
#include <QFile>
#include <QFileInfo>
#include <QHash>
#include <QLocale>
#include <QProcess>
#include <QStandardPaths>
#include <QTextStream>
#include <QVariant>

namespace {

QString basename(const QString &path)
{
    return QFileInfo(path).fileName();
}

QString withoutDesktopSuffix(QString value)
{
    if (value.endsWith(QStringLiteral(".desktop"), Qt::CaseInsensitive)) {
        value.chop(8);
    }
    return value;
}

QString unescapeDesktopValue(const QString &value)
{
    QString result;
    result.reserve(value.size());

    bool escaping = false;
    for (const QChar ch : value) {
        if (!escaping) {
            if (ch == QLatin1Char('\\')) {
                escaping = true;
            } else {
                result.append(ch);
            }
            continue;
        }

        if (ch == QLatin1Char('s')) {
            result.append(QLatin1Char(' '));
        } else if (ch == QLatin1Char('n')) {
            result.append(QLatin1Char('\n'));
        } else if (ch == QLatin1Char('t')) {
            result.append(QLatin1Char('\t'));
        } else if (ch == QLatin1Char('r')) {
            result.append(QLatin1Char('\r'));
        } else {
            result.append(ch);
        }
        escaping = false;
    }

    if (escaping) {
        result.append(QLatin1Char('\\'));
    }
    return result;
}

QString desktopExecToCommandLine(const QString &execLine)
{
    QString result;
    result.reserve(execLine.size());

    bool fieldCode = false;
    for (const QChar ch : execLine) {
        if (fieldCode) {
            if (ch == QLatin1Char('%')) {
                result.append(ch);
            }
            fieldCode = false;
            continue;
        }

        if (ch == QLatin1Char('%')) {
            fieldCode = true;
            continue;
        }

        result.append(ch);
    }

    return result.simplified();
}

QString executableFromExecLine(const QString &execLine)
{
    const QString sanitized = desktopExecToCommandLine(execLine);
    QStringList parts = QProcess::splitCommand(sanitized);
    if (parts.isEmpty()) {
        return {};
    }

    QString program = parts.takeFirst();
    if (program == QStringLiteral("env") && !parts.isEmpty()) {
        while (!parts.isEmpty() && parts.first().contains(QLatin1Char('='))) {
            parts.removeFirst();
        }
        if (!parts.isEmpty()) {
            program = parts.first();
        }
    }

    return basename(program);
}

bool desktopBool(const QHash<QString, QString> &values, const QString &key)
{
    return values.value(key).compare(QStringLiteral("true"), Qt::CaseInsensitive) == 0;
}

QString localizedValue(const QHash<QString, QString> &values, const QString &baseKey)
{
    const QLocale locale;
    const QString localeName = locale.name();
    const QString languageName = QLocale::languageToCode(locale.language());

    const QStringList keys = {
        QStringLiteral("%1[%2]").arg(baseKey, localeName),
        QStringLiteral("%1[%2]").arg(baseKey, languageName),
        baseKey,
    };

    for (const QString &key : keys) {
        const QString value = values.value(key);
        if (!value.isEmpty()) {
            return value;
        }
    }
    return {};
}

QStringList uniqueNonEmpty(const QStringList &values)
{
    QStringList result;
    for (const QString &value : values) {
        if (!value.isEmpty() && !result.contains(value)) {
            result.append(value);
        }
    }
    return result;
}

QString desktopFileId(const QString &path, const QString &baseDir)
{
    const QString relative = QDir(baseDir).relativeFilePath(path);
    QString id = QDir::fromNativeSeparators(relative);
    id.replace(QLatin1Char('/'), QLatin1Char('-'));
    return id;
}

} // namespace

QString normalizeAppId(const QString &value)
{
    QString normalized = value.trimmed().toLower();
    normalized = withoutDesktopSuffix(normalized);

    QString result;
    result.reserve(normalized.size());
    for (const QChar ch : normalized) {
        const ushort code = ch.unicode();
        const bool asciiLetter = (code >= 'a' && code <= 'z');
        const bool asciiDigit = (code >= '0' && code <= '9');
        if (asciiLetter || asciiDigit || ch == QLatin1Char('.') || ch == QLatin1Char('_') || ch == QLatin1Char('-')) {
            result.append(ch);
        }
    }
    return result;
}

QStringList appIdForms(const QString &value)
{
    const QString normalized = normalizeAppId(value);
    return uniqueNonEmpty({
        normalized,
        normalizeAppId(normalized + QStringLiteral(".desktop")),
    });
}

DesktopAppDatabase::DesktopAppDatabase()
{
    reload();
}

void DesktopAppDatabase::reload()
{
    QVector<DesktopApp> apps;
    QStringList seenPaths;

    for (const QString &dir : desktopSearchDirs()) {
        if (!QDir(dir).exists()) {
            continue;
        }

        QDirIterator it(dir, {QStringLiteral("*.desktop")}, QDir::Files, QDirIterator::Subdirectories);
        while (it.hasNext()) {
            const QString path = it.next();
            if (seenPaths.contains(path)) {
                continue;
            }
            seenPaths.append(path);

            DesktopApp app = parseDesktopFile(path, dir);
            if (app.valid) {
                apps.append(app);
            }
        }
    }

    m_apps = apps;
}

DesktopApp DesktopAppDatabase::findApp(const QString &id) const
{
    const QStringList wantedForms = appIdForms(id);
    for (const DesktopApp &app : m_apps) {
        const QStringList candidates = appCandidates(app);
        for (const QString &wanted : wantedForms) {
            if (candidates.contains(wanted)) {
                return app;
            }
        }
    }

    DesktopApp fallback;
    fallback.id = id;
    fallback.name = withoutDesktopSuffix(id);
    fallback.iconName = QStringLiteral("application-x-executable");
    fallback.candidates = {normalizeAppId(id)};
    return fallback;
}

bool DesktopAppDatabase::matchAppId(const DesktopApp &app, const QString &appIdOrClass) const
{
    const QStringList candidateForms = appIdForms(appIdOrClass);
    const QStringList candidates = app.candidates.isEmpty()
        ? QStringList{normalizeAppId(app.id), normalizeAppId(app.name)}
        : app.candidates;

    for (const QString &candidate : candidates) {
        for (const QString &form : appIdForms(candidate)) {
            if (!form.isEmpty() && candidateForms.contains(form)) {
                return true;
            }
        }
    }
    return false;
}

bool DesktopAppDatabase::launch(const DesktopApp &app) const
{
    if (!app.valid) {
        qWarning("astal-niri-dock: no desktop entry found for %s", qPrintable(app.id));
        return false;
    }

    const QString gtkLaunch = QStandardPaths::findExecutable(QStringLiteral("gtk-launch"));
    if (!gtkLaunch.isEmpty()) {
        return QProcess::startDetached(gtkLaunch, {withoutDesktopSuffix(app.id)});
    }

    const QString commandLine = desktopExecToCommandLine(app.execLine);
    QStringList parts = QProcess::splitCommand(commandLine);
    if (parts.isEmpty()) {
        qWarning("astal-niri-dock: desktop entry has no Exec line: %s", qPrintable(app.id));
        return false;
    }

    const QString program = parts.takeFirst();
    return QProcess::startDetached(program, parts);
}

QStringList DesktopAppDatabase::desktopSearchDirs()
{
    QStringList dirs;
    const QString home = QDir::homePath();
    dirs.append(qEnvironmentVariable("XDG_DATA_HOME", home + QStringLiteral("/.local/share")) + QStringLiteral("/applications"));

    const QString dataDirs = qEnvironmentVariable("XDG_DATA_DIRS", QStringLiteral("/usr/local/share:/usr/share"));
    for (const QString &dir : dataDirs.split(QLatin1Char(':'), Qt::SkipEmptyParts)) {
        dirs.append(dir + QStringLiteral("/applications"));
    }

    dirs.append(home + QStringLiteral("/.local/share/flatpak/exports/share/applications"));
    dirs.append(QStringLiteral("/var/lib/flatpak/exports/share/applications"));

    return uniqueNonEmpty(dirs);
}

DesktopApp DesktopAppDatabase::parseDesktopFile(const QString &path, const QString &baseDir)
{
    QFile file(path);
    if (!file.open(QIODevice::ReadOnly | QIODevice::Text)) {
        return {};
    }

    QHash<QString, QString> values;
    bool inDesktopEntry = false;
    QTextStream stream(&file);
    while (!stream.atEnd()) {
        QString line = stream.readLine().trimmed();
        if (line.isEmpty() || line.startsWith(QLatin1Char('#'))) {
            continue;
        }

        if (line.startsWith(QLatin1Char('[')) && line.endsWith(QLatin1Char(']'))) {
            inDesktopEntry = line == QStringLiteral("[Desktop Entry]");
            continue;
        }

        if (!inDesktopEntry) {
            continue;
        }

        const qsizetype equals = line.indexOf(QLatin1Char('='));
        if (equals <= 0) {
            continue;
        }

        const QString key = line.left(equals).trimmed();
        const QString value = unescapeDesktopValue(line.mid(equals + 1).trimmed());
        values.insert(key, value);
    }

    if (values.value(QStringLiteral("Type"), QStringLiteral("Application")) != QStringLiteral("Application")) {
        return {};
    }
    if (desktopBool(values, QStringLiteral("Hidden"))) {
        return {};
    }

    DesktopApp app;
    app.id = desktopFileId(path, baseDir);
    app.name = localizedValue(values, QStringLiteral("Name"));
    app.iconName = values.value(QStringLiteral("Icon"), QStringLiteral("application-x-executable"));
    app.wmClass = values.value(QStringLiteral("StartupWMClass"));
    app.execLine = values.value(QStringLiteral("Exec"));
    app.executable = executableFromExecLine(app.execLine);
    app.desktopPath = path;
    app.valid = !app.id.isEmpty() && !app.name.isEmpty();
    app.candidates = appCandidates(app);
    return app;
}

QStringList DesktopAppDatabase::appCandidates(const DesktopApp &app)
{
    QStringList raw = {
        app.id,
        basename(app.id),
        withoutDesktopSuffix(app.id),
        withoutDesktopSuffix(basename(app.id)),
        app.wmClass,
        app.executable,
    };

    QStringList forms;
    for (const QString &value : raw) {
        forms.append(appIdForms(value));
    }
    return uniqueNonEmpty(forms);
}
