# Build Resources

This directory contains build resources for electron-builder.

## Required Icons

The following icon files are needed before creating production builds:

- `icon.png` - 512x512 PNG icon (used for Linux builds)
- `icon.icns` - macOS icon file
- `icon.ico` - Windows icon file (256x256)

You can generate `.icns` and `.ico` from a source PNG using tools like:
- [electron-icon-builder](https://www.npmjs.com/package/electron-icon-builder)
- [iconutil](https://developer.apple.com/library/archive/documentation/GraphicsAnimation/Conceptual/HighResolutionOSX/Optimizing/Optimizing.html) (macOS only)

## Generating Icons

```bash
npx electron-icon-builder --input=./build/icon.png --output=./build
```
