cmake_minimum_required(VERSION 3.21)

project(astal-niri-dock VERSION 0.2.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Qml Quick QuickControls2)
find_package(LayerShellQt REQUIRED)

qt_add_executable(astal-niri-dock-qt
    src-qt/desktopappdatabase.cpp
    src-qt/desktopappdatabase.h
    src-qt/dockcontroller.cpp
    src-qt/dockcontroller.h
    src-qt/layershellbridge.cpp
    src-qt/layershellbridge.h
    src-qt/main.cpp
    src-qt/themeiconprovider.cpp
    src-qt/themeiconprovider.h
)

qt_add_qml_module(astal-niri-dock-qt
    URI AstalNiriDock
    VERSION 1.0
    QML_FILES
        qml/Main.qml
)

target_link_libraries(astal-niri-dock-qt
    PRIVATE
        Qt6::Core
        Qt6::Gui
        Qt6::Qml
        Qt6::Quick
        Qt6::QuickControls2
)

target_compile_definitions(astal-niri-dock-qt PRIVATE HAVE_LAYER_SHELL_QT=1)
target_link_libraries(astal-niri-dock-qt PRIVATE LayerShellQt::Interface)

install(TARGETS astal-niri-dock-qt RUNTIME DESTINATION bin)
