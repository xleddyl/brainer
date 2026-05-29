#!/usr/bin/env bash
set -euo pipefail

REPO="xleddyl/brainer"
BRAINER_HOME="${HOME}/.brainer"
INSTALL_DIR="${BRAINER_HOME}/app"
BIN_DIR="${BRAINER_HOME}/bin"

if [ "${1:-}" = "--uninstall" ]; then
  echo "Uninstalling brainer..."

  rm -rf "$INSTALL_DIR"
  rm -f "${BIN_DIR}/brainer"

  printf "Delete all data (spaces, models, config)? [y/N] "
  read -r answer
  if [ "$answer" = "y" ] || [ "$answer" = "Y" ]; then
    rm -rf "$BRAINER_HOME"
    echo "All data deleted."
  else
    echo "Binary removed. Data kept at ${BRAINER_HOME}."
  fi

  echo ""
  echo "You can remove '${BIN_DIR}' from your PATH manually."
  echo "Done."
  exit 0
fi

get_latest_version() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" |
    grep '"tag_name"' | sed -E 's/.*"v?([^"]+)".*/\1/'
}

detect_platform() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin) os="darwin" ;;
    Linux)  os="linux" ;;
    *)      echo "Error: unsupported OS: $os" >&2; exit 1 ;;
  esac

  case "$arch" in
    x86_64|amd64)  arch="x64" ;;
    arm64|aarch64) arch="arm64" ;;
    *)             echo "Error: unsupported architecture: $arch" >&2; exit 1 ;;
  esac

  echo "${os}-${arch}"
}

get_current_version() {
  if [ -x "${BIN_DIR}/brainer" ]; then
    "${BIN_DIR}/brainer" --version 2>/dev/null || echo "unknown"
  else
    echo "none"
  fi
}

add_to_path() {
  if echo "$PATH" | tr ':' '\n' | grep -qx "$BIN_DIR"; then
    return
  fi

  local line="export PATH=\"${BIN_DIR}:\$PATH\""
  local shell_rc=""

  case "$(basename "$SHELL")" in
    zsh)  shell_rc="${HOME}/.zshrc" ;;
    bash)
      if [ -f "${HOME}/.bash_profile" ]; then
        shell_rc="${HOME}/.bash_profile"
      else
        shell_rc="${HOME}/.bashrc"
      fi
      ;;
    fish) shell_rc="${HOME}/.config/fish/config.fish"; line="set -gx PATH ${BIN_DIR} \$PATH" ;;
    *)    shell_rc="${HOME}/.profile" ;;
  esac

  if [ -n "$shell_rc" ] && ! grep -qF "$BIN_DIR" "$shell_rc" 2>/dev/null; then
    echo "" >> "$shell_rc"
    echo "# brainer" >> "$shell_rc"
    echo "$line" >> "$shell_rc"
    echo "  Added ${BIN_DIR} to PATH in ${shell_rc}"
    echo "  Run 'source ${shell_rc}' or open a new terminal to use brainer."
  fi
}

main() {
  local current_version
  current_version="$(get_current_version)"

  local version platform archive_name url
  version="$(get_latest_version)"
  platform="$(detect_platform)"

  if [ "$current_version" = "$version" ]; then
    echo "brainer v${version} is already up to date."
    exit 0
  fi

  if [ "$current_version" = "none" ]; then
    echo "Installing brainer..."
  else
    echo "Updating brainer v${current_version} -> v${version}..."
  fi

  archive_name="brainer-v${version}-${platform}.tar.gz"
  url="https://github.com/${REPO}/releases/download/v${version}/${archive_name}"

  echo "  Version:  v${version}"
  echo "  Platform: ${platform}"

  local tmpdir=""
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  echo "  Downloading..."
  if ! curl -fsSL "$url" -o "${tmpdir}/${archive_name}"; then
    echo "Error: failed to download ${archive_name}" >&2
    echo "Check that a release exists for your platform at:" >&2
    echo "  https://github.com/${REPO}/releases" >&2
    exit 1
  fi

  echo "  Extracting..."
  tar -xzf "${tmpdir}/${archive_name}" -C "$tmpdir"

  echo "  Installing to ${INSTALL_DIR}..."
  mkdir -p "$BIN_DIR"
  rm -rf "$INSTALL_DIR"
  mv "${tmpdir}/brainer" "$INSTALL_DIR"
  ln -sf "${INSTALL_DIR}/bin/brainer" "${BIN_DIR}/brainer"

  add_to_path

  echo ""
  echo "brainer v${version} installed! Run 'brainer --help' to get started."
}

main
