# Sidebound Distribution

This directory contains compiled executables produced by `deno compile`.

## Building

From the repository root:

```sh
# macOS (native architecture)
deno task compile:mac

# macOS (explicit ARM64 cross-compile)
deno task compile:mac-arm64

# Windows (cross-compile)
deno task compile:win

# Linux (cross-compile)
deno task compile:linux
```

## Native Library Requirements

The compiled executable loads SDL3 via FFI at runtime. You must have the native
libraries available on the target machine.

### macOS

Install via Homebrew:

```sh
brew install sdl3 sdl3_image
```

Libraries are typically located at:
- Apple Silicon: `/opt/homebrew/lib/libSDL3.dylib`
- Intel: `/usr/local/lib/libSDL3.dylib`

Set `DENO_SDL3_PATH` if your libraries are in a non-standard location:

```sh
export DENO_SDL3_PATH=/opt/homebrew/lib
./sidebound
```

### Windows

Place the following DLLs beside `sidebound.exe`:
- `SDL3.dll`
- `SDL3_image.dll`

Download from https://github.com/libsdl-org/SDL/releases (SDL3 runtime binaries).

### Linux

Install the SDL3 runtime package for your distribution:

```sh
# Ubuntu/Debian (when available)
sudo apt install libsdl3-0 libsdl3-image-0

# Fedora (when available)
sudo dnf install SDL3 SDL3_image

# Or build from source: https://github.com/libsdl-org/SDL
```

Set `DENO_SDL3_PATH` if libraries are in a non-standard location:

```sh
export DENO_SDL3_PATH=/usr/local/lib
./sidebound
```

## Directory Structure

After compilation, this directory should contain:

```
dist/
  sidebound          # macOS/Linux executable
  sidebound.exe      # Windows executable (cross-compiled)
  README.md          # This file
```

Native libraries are NOT bundled in the executable — they must be installed
on the target system or placed beside the executable (Windows).

