#include "themeiconprovider.h"

#include <QIcon>
#include <QPainter>
#include <QUrl>

ThemeIconProvider::ThemeIconProvider()
    : QQuickImageProvider(QQuickImageProvider::Pixmap)
{
}

QPixmap ThemeIconProvider::requestPixmap(const QString &id, QSize *size, const QSize &requestedSize)
{
    const QString iconName = QUrl::fromPercentEncoding(id.toUtf8());
    const QSize targetSize = requestedSize.isValid() ? requestedSize : QSize(38, 38);

    QIcon icon = QIcon::fromTheme(iconName);
    if (icon.isNull()) {
        icon = QIcon::fromTheme(QStringLiteral("application-x-executable"));
    }

    QPixmap pixmap = icon.pixmap(targetSize);
    if (pixmap.isNull()) {
        pixmap = QPixmap(targetSize);
        pixmap.fill(Qt::transparent);
        QPainter painter(&pixmap);
        painter.setRenderHint(QPainter::Antialiasing);
        painter.setBrush(QColor(210, 215, 250, 180));
        painter.setPen(Qt::NoPen);
        painter.drawRoundedRect(pixmap.rect().adjusted(4, 4, -4, -4), 8, 8);
    }

    if (size) {
        *size = pixmap.size();
    }
    return pixmap;
}
