#include "layershellbridge.h"

#include <QMargins>
#include <QSize>
#include <QWindow>
#include <QtGlobal>

#ifdef HAVE_LAYER_SHELL_QT
#include <LayerShellQt/Shell>
#include <LayerShellQt/Window>
#endif

LayerShellBridge::LayerShellBridge(QObject *parent)
    : QObject(parent)
{
}

bool LayerShellBridge::available() const
{
#ifdef HAVE_LAYER_SHELL_QT
    return true;
#else
    return false;
#endif
}

void LayerShellBridge::initialize()
{
    if (qEnvironmentVariableIsEmpty("QT_QPA_PLATFORM")) {
        qputenv("QT_QPA_PLATFORM", "wayland");
    }

#ifdef HAVE_LAYER_SHELL_QT
    LayerShellQt::Shell::useLayerShell();
#endif
}

void LayerShellBridge::configureDock(QWindow *window)
{
    configure(window, QStringLiteral("astal-niri-dock"), 96, 4);
}

void LayerShellBridge::configureSensor(QWindow *window)
{
    configure(window, QStringLiteral("astal-niri-dock-sensor"), 6, 0);
}

void LayerShellBridge::configure(QWindow *window, const QString &scope, int height, int bottomMargin)
{
    if (!window) {
        return;
    }

    window->setTitle(scope);
    window->setFlags(Qt::FramelessWindowHint | Qt::WindowDoesNotAcceptFocus | Qt::WindowStaysOnTopHint);

    // Ensure the platform window is created so LayerShellQt can attach.
    if (!window->handle()) {
        window->create();
    }

#ifdef HAVE_LAYER_SHELL_QT
    LayerShellQt::Window *layerWindow = LayerShellQt::Window::get(window);
    if (!layerWindow) {
        qWarning("astal-niri-dock: LayerShellQt::Window::get() returned null for %s", qPrintable(scope));
        return;
    }
    layerWindow->setScope(scope);
    layerWindow->setLayer(LayerShellQt::Window::LayerOverlay);
    layerWindow->setKeyboardInteractivity(LayerShellQt::Window::KeyboardInteractivityNone);
    layerWindow->setAnchors(static_cast<LayerShellQt::Window::Anchors>(
        LayerShellQt::Window::AnchorBottom | LayerShellQt::Window::AnchorLeft | LayerShellQt::Window::AnchorRight));
    layerWindow->setExclusiveZone(0);
    layerWindow->setMargins(QMargins(0, 0, 0, bottomMargin));
    layerWindow->setDesiredSize(QSize(0, height));
    layerWindow->setCloseOnDismissed(false);
#else
    Q_UNUSED(height)
    Q_UNUSED(bottomMargin)
#endif
}
