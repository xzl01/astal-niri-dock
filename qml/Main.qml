import QtQuick
import QtQuick.Controls
import QtQuick.Window

Item {
    id: root

    readonly property int dockHeight: 96
    readonly property int sensorHeight: 6

    Window {
        id: dockWindow

        width: screen ? screen.width : 1024
        height: root.dockHeight
        x: screen ? screen.virtualX : 0
        y: screen ? screen.virtualY + screen.height - height - 4 : 0
        color: "transparent"
        visible: false
        flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus | Qt.WindowStaysOnTopHint

        Component.onCompleted: {
            layerShell.configureDock(dockWindow)
            if (dockController.showDock)
                showDockAnimation.restart()
        }

        Connections {
            target: dockController

            function onShowDockChanged() {
                if (dockController.showDock) {
                    hideDockAnimation.stop()
                    showDockAnimation.restart()
                } else {
                    showDockAnimation.stop()
                    hideDockAnimation.restart()
                }
            }
        }

        Item {
            id: dockContainer

            anchors.fill: parent
            opacity: 0
            scale: 0.90
            transform: Translate {
                id: dockSlide
                y: 92
            }

            Item {
                id: dockHoverRegion

                anchors.horizontalCenter: parent.horizontalCenter
                anchors.bottom: parent.bottom
                anchors.bottomMargin: 10
                width: dockBar.width
                height: 72

                HoverHandler {
                    id: dockHoverHandler

                    onHoveredChanged: {
                        if (hovered)
                            dockController.dockEntered()
                        else
                            dockController.dockExited()
                    }
                }

                Rectangle {
                    id: dockBarShadow

                    anchors.fill: dockBar
                    anchors.topMargin: 8
                    radius: 24
                    color: "#66000000"
                    opacity: 0.40
                }

                Rectangle {
                    id: dockBar

                    anchors.horizontalCenter: parent.horizontalCenter
                    anchors.verticalCenter: parent.verticalCenter
                    width: Math.max(272, dockRow.implicitWidth + 24)
                    height: 70
                    radius: 24
                    color: "#c2161826"
                    border.width: 1
                    border.color: "#17ffffff"
                    clip: true

                    Rectangle {
                        anchors.fill: parent
                        radius: parent.radius
                        gradient: Gradient {
                            GradientStop { position: 0.00; color: "#3dffffff" }
                            GradientStop { position: 0.24; color: "#12ffffff" }
                            GradientStop { position: 0.66; color: "#05000000" }
                            GradientStop { position: 1.00; color: "#14ffffff" }
                        }
                    }

                    Rectangle {
                        anchors.left: parent.left
                        anchors.right: parent.right
                        anchors.top: parent.top
                        anchors.margins: 1
                        height: 1
                        color: "#4dffffff"
                        radius: 1
                    }

                    Row {
                        id: dockRow

                        anchors.centerIn: parent
                        spacing: 6

                        Repeater {
                            model: dockController.entries

                            Item {
                                id: dockItemBox

                                required property var modelData
                                required property int index

                                width: 60
                                height: 64
                                property bool hovered: false
                                property bool focused: Boolean(modelData.focused)
                                property bool urgent: Boolean(modelData.urgent)
                                property bool running: Boolean(modelData.running)

                                ToolTip.visible: hovered
                                ToolTip.delay: 350
                                ToolTip.text: modelData.tooltip

                                Rectangle {
                                    id: dockButton

                                    width: 54
                                    height: 54
                                    anchors.horizontalCenter: parent.horizontalCenter
                                    y: dockItemBox.hovered ? -7 : 0
                                    scale: dockItemBox.hovered ? 1.09 : 1.0
                                    radius: 18
                                    color: dockItemBox.urgent
                                        ? "#3dff697d"
                                        : dockItemBox.focused
                                            ? "#339baaff"
                                            : dockItemBox.hovered
                                                ? "#24ffffff"
                                                : "#05ffffff"
                                    border.width: 1
                                    border.color: dockItemBox.urgent
                                        ? "#47ff697d"
                                        : dockItemBox.focused
                                            ? "#389baaff"
                                            : dockItemBox.hovered
                                                ? "#1affffff"
                                                : "#05ffffff"

                                    Behavior on y {
                                        NumberAnimation { duration: 240; easing.type: Easing.OutCubic }
                                    }

                                    Behavior on scale {
                                        NumberAnimation { duration: 240; easing.type: Easing.OutCubic }
                                    }

                                    Behavior on color {
                                        ColorAnimation { duration: 180 }
                                    }

                                    Image {
                                        anchors.centerIn: parent
                                        width: 38
                                        height: 38
                                        sourceSize.width: 38
                                        sourceSize.height: 38
                                        smooth: true
                                        source: "image://themeicon/" + encodeURIComponent(modelData.iconName || "application-x-executable")
                                    }

                                    MouseArea {
                                        anchors.fill: parent
                                        hoverEnabled: true
                                        cursorShape: Qt.PointingHandCursor
                                        onEntered: dockItemBox.hovered = true
                                        onExited: dockItemBox.hovered = false
                                        onClicked: dockController.activate(index)
                                    }
                                }

                                Rectangle {
                                    id: runningDot

                                    anchors.horizontalCenter: parent.horizontalCenter
                                    anchors.bottom: parent.bottom
                                    width: dockItemBox.focused ? 20 : dockItemBox.running ? 4 : 0
                                    height: dockItemBox.running ? 4 : 0
                                    radius: 999
                                    color: dockItemBox.focused ? "#a8c8ff" : "#99d2d7fa"
                                    opacity: dockItemBox.running ? 1 : 0

                                    Behavior on width {
                                        NumberAnimation { duration: 280; easing.type: Easing.OutCubic }
                                    }

                                    Behavior on opacity {
                                        NumberAnimation { duration: 160 }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        ParallelAnimation {
            id: showDockAnimation

            ScriptAction {
                script: {
                    dockWindow.visible = true
                    dockContainer.opacity = 0
                    dockContainer.scale = 0.90
                    dockSlide.y = 92
                }
            }
            NumberAnimation { target: dockContainer; property: "opacity"; to: 1; duration: 500; easing.type: Easing.OutCubic }
            NumberAnimation { target: dockContainer; property: "scale"; to: 1; duration: 500; easing.type: Easing.OutCubic }
            NumberAnimation { target: dockSlide; property: "y"; to: 0; duration: 500; easing.type: Easing.OutCubic }
        }

        SequentialAnimation {
            id: hideDockAnimation

            ParallelAnimation {
                NumberAnimation { target: dockContainer; property: "opacity"; to: 0; duration: 500; easing.type: Easing.OutCubic }
                NumberAnimation { target: dockContainer; property: "scale"; to: 0.90; duration: 500; easing.type: Easing.OutCubic }
                NumberAnimation { target: dockSlide; property: "y"; to: 92; duration: 500; easing.type: Easing.OutCubic }
            }
            ScriptAction { script: dockWindow.visible = false }
        }
    }

    Window {
        id: sensorWindow

        width: screen ? screen.width : 1024
        height: root.sensorHeight
        x: screen ? screen.virtualX : 0
        y: screen ? screen.virtualY + screen.height - height : 0
        color: "transparent"
        visible: false
        flags: Qt.FramelessWindowHint | Qt.WindowDoesNotAcceptFocus | Qt.WindowStaysOnTopHint

        Component.onCompleted: {
            layerShell.configureSensor(sensorWindow)
            visible = true
        }

        Rectangle {
            anchors.fill: parent
            color: "#01000000"
        }

        HoverHandler {
            id: sensorHoverHandler

            onHoveredChanged: {
                if (hovered)
                    dockController.edgeEntered()
                else
                    dockController.edgeExited()
            }
        }
    }
}
