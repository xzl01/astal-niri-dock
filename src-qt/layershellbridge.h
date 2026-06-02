#pragma once

#include <QObject>

class QWindow;

class LayerShellBridge : public QObject {
    Q_OBJECT
    Q_PROPERTY(bool available READ available CONSTANT)

public:
    explicit LayerShellBridge(QObject *parent = nullptr);

    bool available() const;
    static void initialize();

    Q_INVOKABLE void configureDock(QWindow *window);
    Q_INVOKABLE void configureSensor(QWindow *window);

private:
    void configure(QWindow *window, const QString &scope, int height, int bottomMargin);
};
