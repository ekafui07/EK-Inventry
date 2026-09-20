# 💻 EK GearFlow — Native Windows Setup Guide

This guide walks you through setting up **EK GearFlow** on a clean **Windows 10 / 11** PC natively (without WSL).

---

## 📋 Phase 1: Prerequisites (One-Time Installation)

Install these 3 standard tools on the clean PC:

### 1. Install Node.js (LTS)
1. Download the LTS installer from [https://nodejs.org](https://nodejs.org).
2. Run the installer, accept the default settings, and complete installation.
3. Verify in Command Prompt:
   ```cmd
   node -v
   npm -v
   ```

### 2. Install Git for Windows
1. Download from [https://gitforwindows.org](https://gitforwindows.org).
2. Run the installer with default options.

### 3. Install Python 3
1. Download from [https://www.python.org/downloads/](https://www.python.org/downloads/) (or search Python in the Microsoft Store).
2. ⚠️ **Important:** During installation, check the box **"Add python.exe to PATH"**.
3. Verify in Command Prompt:
   ```cmd
   python --version
   ```

---

## 📦 Phase 2: Download Code & Install Dependencies

1. Open **Command Prompt** and choose where to store the project (e.g. `C:\Apps\EK-Inventry`):
   ```cmd
   cd C:\
   mkdir Apps
   cd Apps
   git clone https://github.com/ekafui07/EK-Inventry.git
   cd EK-Inventry
   ```
   *(Or copy the `EK-Inventry` directory directly from a USB flash drive).*

2. Install the application dependencies:
   ```cmd
   :: Install root runner packages
   npm install

   :: Install backend packages
   cd backend
   npm install
   cd ..
   ```

---

## ⚡ Phase 3: Verify First-Time Manual Launch

1. Start the services:
   ```cmd
   npm start
   ```
2. Open your web browser and go to: **[http://localhost:8080](http://localhost:8080)**
3. Log in with the pre-configured credentials:
   - **Email:** `admin@ekgearflow.com`
   - **Password:** `admin123`
4. Press `Ctrl + C` in your Command Prompt to stop the server for now.

---

## 🚀 Phase 4: Configure Automatic Startup on PC Boot

Set up Windows to start EK GearFlow silently in the background whenever the computer is turned on:

### 1. Create `launch.bat`
In your project folder (`C:\Apps\EK-Inventry\launch.bat`), create this file:

```bat
@echo off
title EK GearFlow Launcher
cd /d "%~dp0"
start /b npm start
timeout /t 3 /nobreak >nul
start http://localhost:8080
```

### 2. Create `start-silent.vbs` (Hides the black console window)
In your project folder (`C:\Apps\EK-Inventry\start-silent.vbs`), create this file:

```vbs
Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "C:\Apps\EK-Inventry"
WshShell.Run "launch.bat", 0, False
```

### 3. Add to Windows Startup Folder
1. Press `Win + R` on the keyboard.
2. Type **`shell:startup`** and press **Enter**.
3. Right-click inside the startup folder &rarr; **New &rarr; Shortcut**.
4. Browse and select `C:\Apps\EK-Inventry\start-silent.vbs`.
5. Click **Finish**.

---

## 🖥️ Phase 5: Create a Desktop App Window Icon

To give the client a standalone desktop application window:

1. Right-click on the Desktop &rarr; **New &rarr; Shortcut**.
2. Set location target to:
   ```cmd
   msedge.exe --app=http://localhost:8080
   ```
   *(Or for Google Chrome: `chrome.exe --app=http://localhost:8080`)*
3. Name the shortcut: **`EK GearFlow`**.
4. Right-click the shortcut &rarr; **Properties &rarr; Change Icon** to customize its appearance.

---

## ✅ System Ready

Whenever the PC boots up, **EK GearFlow** starts quietly in the background and opens the dashboard ready for client operations!
