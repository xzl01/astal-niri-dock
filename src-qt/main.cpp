#include "dockcontroller.h"
#include "layershellbridge.h"
#include "themeiconprovider.h"

#include <QByteArray>
#include <QCoreApplication>
#include <QDateTime>
#include <QFile>
#include <QGuiApplication>
#include <QMutex>
#include <QMutexLocker>
#include <QQmlApplicationEngine>
#include <QQmlContext>
#include <QIcon>

#include <cstddef>
#include <cstdio>
#include <cstdlib>

namespace {

constexpr const char *LogPath = "/tmp/astal-niri-dock.log";

const char *messageTypeName(QtMsgType type)
{
    switch (type) {
    case QtDebugMsg:
        return "debug";
    case QtInfoMsg:
        return "info";
    case QtWarningMsg:
        return "warning";
    case QtCriticalMsg:
        return "critical";
    case QtFatalMsg:
        return "fatal";
    }
    return "message";
}

void dockMessageHandler(QtMsgType type, const QMessageLogContext &, const QString &message)
{
    static QMutex mutex;
    const QString line = QStringLiteral("%1 [%2] %3\n")
        .arg(QDateTime::currentDateTime().toString(Qt::ISODateWithMs), QString::fromLatin1(messageTypeName(type)), message);
    const QByteArray bytes = line.toUtf8();

    QMutexLocker locker(&mutex);

    QFile file(QString::fromLatin1(LogPath));
    if (file.open(QIODevice::WriteOnly | QIODevice::Append | QIODevice::Text)) {
        file.write(bytes);
    }

    std::fwrite(bytes.constData(), 1, static_cast<std::size_t>(bytes.size()), stderr);
    std::fflush(stderr);

    if (type == QtFatalMsg) {
        std::abort();
    }
}

} // namespace

int main(int argc, char *argv[])
{
    QFile::remove(QString::fromLatin1(LogPath));
    qInstallMessageHandler(dockMessageHandler);

    LayerShellBridge::initialize();

    QGuiApplication app(argc, argv);
    QGuiApplication::setApplicationName(QStringLiteral("astal-niri-dock"));
    QGuiApplication::setApplicationDisplayName(QStringLiteral("Astal Niri Dock"));
    QGuiApplication::setDesktopFileName(QStringLiteral("astal-niri-dock"));

    if (QIcon::themeName().isEmpty()) {
        QIcon::setThemeName(QStringLiteral("hicolor"));
    }

    DockController dockController;
    LayerShellBridge layerShell;

    QQmlApplicationEngine engine;
    engine.rootContext()->setContextProperty(QStringLiteral("dockController"), &dockController);
    engine.rootContext()->setContextProperty(QStringLiteral("layerShell"), &layerShell);
    engine.addImageProvider(QStringLiteral("themeicon"), new ThemeIconProvider);

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed, &app, []() {
        QCoreApplication::exit(1);
    }, Qt::QueuedConnection);

    engine.loadFromModule(QStringLiteral("AstalNiriDock"), QStringLiteral("Main"));

    return app.exec();
}
