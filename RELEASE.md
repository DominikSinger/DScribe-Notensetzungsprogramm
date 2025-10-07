# DScribe Release-Management

## Installer/Portable Builds
- Windows: NSIS-Installer (`dist/DScribe Setup x64.exe`)
- macOS: DMG (`dist/DScribe-x.y.z.dmg`)
- Linux: AppImage, deb, rpm (`dist/DScribe-x.y.z.AppImage` etc.)

## Auto-Update
- electron-builder ist für generische Updates vorkonfiguriert (siehe `electron-builder.yml` → `publish.url`)
- Für automatische Updates muss ein Update-Server (z.B. GitHub Releases, S3, eigener Server) bereitgestellt werden
- Die App prüft beim Start auf Updates, wenn `publish`-URL gesetzt ist

## Release-Ablauf
1. `npx electron-builder --win --x64` (Windows-Installer)
2. `npx electron-builder --mac` (macOS)
3. `npx electron-builder --linux` (Linux)
4. Installer/Portable im `dist/`-Ordner hochladen
5. Update-Server/URL anpassen, falls Auto-Update genutzt werden soll

## Hinweise
- Versionierung erfolgt über `package.json` (`version`-Feld)
- Changelog und Release-Notes in `RELEASE.md` pflegen
- Für portable Version: Inhalt aus `dist/win-unpacked` verwenden

## Beispiel für Update-Server (optional)
- GitHub Releases: https://github.com/<user>/<repo>/releases/latest/download/
- Eigener Server: https://your-update-server.com/updates/

## Changelog
- 12.0.0: Erste vollständige Version mit allen Kernfunktionen, Plugins, Cloud, Audio, OMR, Export/Import, klassischer Menüleiste
