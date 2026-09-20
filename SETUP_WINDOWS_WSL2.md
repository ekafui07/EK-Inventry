# 🐧 EK GearFlow — Windows + WSL2 (Ubuntu) Setup Guide

This guide walks you through setting up **EK GearFlow** on a clean Windows PC using **WSL2 (Windows Subsystem for Linux)** with **Ubuntu**.

---

## 🌟 Why WSL2?
- **Identical to Cloud Production**: Runs in the exact same Linux environment used by cloud servers.
- **Native Performance & Stability**: Fast file I/O, native process execution, and seamless networking.
- **Invisible Execution**: Windows can execute background WSL commands silently without exposing terminals to the client.

---

## 🐧 Step 1: Install WSL2 & Ubuntu on Windows

1. Open **PowerShell as Administrator** on the clean Windows PC.
2. Run the automatic WSL installer:
   ```powershell
   wsl --install
   ```
3. Restart the computer when prompted.
4. After restarting, a console window will appear asking you to set an **Ubuntu Username** and **Password** (e.g. username: `gearflow`).

---

## 📦 Step 2: Install Node.js, Python3 & Git inside Ubuntu

Inside the Ubuntu terminal, run:

```bash
# Update Ubuntu package lists
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x (LTS), Python 3, and Git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs python3 git
```

Verify your installation:
```bash
node -v
npm -v
python3 --version
```

---

## 📂 Step 3: Clone Code & Install Dependencies

In the Ubuntu terminal, clone the repository into the user's home folder:

```bash
cd ~
git clone https://github.com/ekafui07/EK-Inventry.git
cd EK-Inventry

# Install root runner and backend dependencies
npm install
cd backend && npm install && cd ..
```

---

## ⚡ Step 4: Verify First Manual Run

1. Start the application inside Ubuntu:
   ```bash
   npm start
   ```
2. On the **Windows** side, open your browser (Edge or Chrome) and navigate to:
   **[http://localhost:8080](http://localhost:8080)**
   *(WSL2 automatically bridges localhost to Windows seamlessly)*.
3. Log in with the pre-configured credentials:
   - **Email:** `admin@ekgearflow.com`
   - **Password:** `admin123`
4. Press `Ctrl + C` in Ubuntu to stop the test run.

---

## 🚀 Step 5: Configure Silent Windows Auto-Startup on Boot

Configure Windows to start the WSL2 server invisibly when the PC turns on:

### 1. Create `start-gearflow-wsl.vbs` on Windows
On Windows, save a file at `C:\Users\%USERNAME%\start-gearflow-wsl.vbs` (or anywhere convenient) with this content:

```vbs
Set WshShell = CreateObject("WScript.Shell")

' 1. Start EK GearFlow inside WSL Ubuntu invisibly (0 = completely hidden window)
WshShell.Run "wsl.exe -d Ubuntu -e bash -lic ""cd ~/EK-Inventry && npm start""", 0, False

' 2. Wait 3 seconds for backend (3000) and frontend (8080) to initialize
WScript.Sleep 3000

' 3. Open the web app in the default browser
WshShell.Run "http://localhost:8080", 1, False
```

### 2. Put it in Windows Startup
1. Press `Win + R` on Windows, type **`shell:startup`**, and hit **Enter**.
2. Create a shortcut to your **`start-gearflow-wsl.vbs`** file inside this folder.

---

## 🖥️ Step 6: Create a Desktop App Window Icon

1. Right-click the Windows Desktop &rarr; **New &rarr; Shortcut**.
2. Set location target to:
   ```cmd
   msedge.exe --app=http://localhost:8080
   ```
   *(Or for Google Chrome: `chrome.exe --app=http://localhost:8080`)*
3. Name it **`EK GearFlow`**.
4. Customize its icon via **Right-click &rarr; Properties &rarr; Change Icon**.

---

## ✅ System Ready

Upon PC startup, Windows launches the WSL2 Linux server in the background and opens the frameless app window ready for immediate use!
