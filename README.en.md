# RepoDesk

<p align="center">
  A Windows desktop control center for organizing, launching, and monitoring local projects.
</p>

<p align="center">
  <a href="README.md">繁體中文</a>
  ·
  <a href="README.en.md">English</a>
</p>

<p align="center">
  <img alt="Version v0.2.0" src="https://img.shields.io/badge/version-v0.2.0-7c6cff">
  <img alt="Windows 10 and Windows 11" src="https://img.shields.io/badge/platform-Windows%2010%20%7C%2011-3b82f6">
  <img alt="x64 architecture" src="https://img.shields.io/badge/architecture-x64-16b8a6">
</p>

<p align="center">
  <a href="/Martinweiting/RepoDesk/releases/download/v0.2.0/RepoDesk%20Setup.exe"><strong>Download the Windows installer</strong></a>
  ·
  <a href="/Martinweiting/RepoDesk/releases/latest">View the latest release</a>
</p>

RepoDesk collects local projects from different drives and folders into one workspace. Scan for projects, add artwork and descriptions, set launch commands, then use each card to start a development server, inspect terminal output, or open the running site.

![RepoDesk project library](docs/images/project-library.png)

## Where RepoDesk fits

As a project library grows, finding folders, opening terminals, entering commands, and copying local URLs becomes repetitive. RepoDesk keeps each project's path and launch settings together and provides the following controls:

- Scan a folder and add several local projects in one pass.
- Find projects by name, description, tag, path, status, or category.
- Start, stop, or restart a project from its card.
- Read live terminal output and open a detected `localhost` URL.
- Open the project folder, PowerShell, Visual Studio Code, or GitHub page.
- Organize a large library with favorites, statuses, custom categories, icons, and preview images.

## Download and installation

RepoDesk `v0.2.0` is available as a Windows x64 installer. Requirements:

- Windows 10 or Windows 11, x64.
- The runtime required by each managed project, such as Node.js, Godot, Python, Rust, or .NET.
- Microsoft Edge, which is normally included with Windows. Google Chrome and Visual Studio Code are optional.

Installation:

1. Open [Releases](/Martinweiting/RepoDesk/releases/latest) and download `RepoDesk Setup.exe`.
2. Run the installer and choose an installation folder.
3. Start RepoDesk from its desktop shortcut or the Start menu.

The current installer is unsigned. If Windows SmartScreen displays a warning, confirm that the file came from this project's GitHub Releases page, then select “More info” and “Run anyway.”

## Add projects for the first time

### Scan a project library

1. Select “Scan folder” in the upper-right corner.
2. Choose the parent folder that contains your projects.
3. RepoDesk searches to the configured depth and reports how many projects were found, added, and updated.
4. Review the cards on the home screen. Scanning the same location again updates existing entries without adding duplicates.

RepoDesk asks you to select a scan location each time and does not store a default scan root. The home screen keeps the five most recent unique scan records so you can see which locations were handled recently.

### Add one project

Select “Add project,” then choose the project's folder. RepoDesk reads the available project files and fills in the name, description, technology tags, GitHub URL, and candidate launch commands.

### Recognized project types

| Project type | Detection file | Command that may be filled in |
| --- | --- | --- |
| Node.js and web projects | `package.json` | `npm run dev`, `npm run start`, `npm run serve`, or `npm run preview` |
| Godot | `project.godot` | `godot --editor` |
| Python | `pyproject.toml`, launch support when `app.py` is present | `python app.py` |
| Rust | `Cargo.toml` | `cargo run` |
| .NET | `.sln` | `dotnet run` |

## Configure a card and launch a project

Select a project card to open its settings panel. You can edit its name, description, tags, status, category, accent color, launch command, browser, fixed URL, and GitHub URL.

![Project settings panel for artwork, details, and launch behavior](docs/images/project-settings.png)

Use this order for the first card:

1. Confirm that the launch command works when run from the project folder.
2. Choose a built-in icon, or import a custom icon and a 16:9 preview image.
3. Enter a fixed URL if the server output does not print a `localhost` address.
4. Save the changes, return to the home screen, and select “Start project.”
5. Select the command row on the card to view live terminal output. After startup, “Open site” opens the detected address, and the stop control ends the full process tree.

Launch commands run with the permissions of the current Windows user. Add trusted projects only, and inspect unfamiliar commands before running them.

## Organize the project library

The search box matches names, descriptions, tags, and full paths. Press `Ctrl+K` to focus it. The sidebar filters the library by running state, favorites, development status, and custom project categories.

Preferences control icon or preview card layouts, the default browser, automatic browser opening after URL detection, and project categories. A project can override the global browser setting.

![Preferences for card layout, browser selection, and project categories](docs/images/preferences.png)

Additional library controls:

- Favorites are sorted to the front of the list.
- “Batch manage” selects multiple cards from the current search or filter result.
- Custom icons are cropped to 256×256. Preview images are cropped to 1280×720.
- Card shortcuts open File Explorer and PowerShell. Visual Studio Code is available from the project settings panel.

## Local data and removal behavior

RepoDesk has no account or cloud sync service. Project records and preferences stay in Electron's local `userData` directory in a file named `repodesk-data.json`.

Removing a card, using batch management, or clearing the library removes the RepoDesk record only. The original project folder and its files remain untouched. Scanning does not modify the managed project.

## Current limitations

- The current release provides a Windows x64 installer only.
- Each project still requires its own runtime and command-line tools.
- Google Chrome and Visual Studio Code must be installed separately before their shortcuts can work.
- A card with a missing source folder is marked unavailable and cannot be started.
- Closing RepoDesk stops managed processes that are still running.

## Version

The current public version is `v0.2.0`. It includes project scanning and management, card artwork, custom categories, live terminal output, development URL detection, and Edge or Chrome launch settings. The installer and SHA-256 checksum are listed on the [GitHub Release](/Martinweiting/RepoDesk/releases/tag/v0.2.0).
