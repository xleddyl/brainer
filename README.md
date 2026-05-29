# Brainer

## Install

```bash
curl -fsSL https://raw.githubusercontent.com/xleddyl/brainer/main/scripts/install.sh | bash
```

To update:

```bash
curl -fsSL https://raw.githubusercontent.com/xleddyl/brainer/main/scripts/install.sh | bash
```

To uninstall:

```bash
curl -fsSL https://raw.githubusercontent.com/xleddyl/brainer/main/scripts/install.sh | bash -s -- --uninstall
```

## Release

```bash
./scripts/release.sh
```

The script bumps the version in `package.json`, commits, tags, and pushes. GitHub Actions then builds for macOS (arm64, x64) and Linux (x64), bundles Node.js, and publishes a GitHub Release.
