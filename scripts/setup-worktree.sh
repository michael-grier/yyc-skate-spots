#!/usr/bin/env bash
# Prepares a linked worktree with the primary checkout's local environment and
# dependencies that match this branch's lockfile.
set -euo pipefail

readonly ENV_FILES=(".env" ".env.local")

fail() {
  printf 'Worktree setup failed: %s\n' "$1" >&2
  exit 1
}

# Resolves a Git checkout root without preserving a caller's symlinked path.
git_root() {
  local root
  root=$(git -C "$1" rev-parse --show-toplevel 2>/dev/null) || return 1
  (cd "$root" && pwd -P)
}

# The common directory identifies the repository shared by every linked worktree.
git_common_dir() {
  local common_dir
  common_dir=$(git -C "$1" rev-parse --path-format=absolute --git-common-dir 2>/dev/null) || return 1
  (cd "$common_dir" && pwd -P)
}

# Git lists the primary checkout first; -z keeps unusual path characters intact.
primary_worktree_root() {
  local worktree_record
  IFS= read -r -d '' worktree_record < <(git -C "$1" worktree list --porcelain -z 2>/dev/null) ||
    return 1

  case "$worktree_record" in
    "worktree "*)
      git_root "${worktree_record#worktree }"
      ;;
    *) return 1 ;;
  esac
}

worktree_root=$(git_root ".") || fail "run this command inside a Git checkout."
worktree_common_dir=$(git_common_dir "$worktree_root") || fail "could not resolve this repository."

if [ -n "${T3CODE_WORKTREE_PATH:-}" ]; then
  t3_worktree_root=$(git_root "$T3CODE_WORKTREE_PATH") ||
    fail "T3CODE_WORKTREE_PATH is not a Git checkout: $T3CODE_WORKTREE_PATH"
  if [ "$t3_worktree_root" != "$worktree_root" ]; then
    fail "T3CODE_WORKTREE_PATH does not match the current checkout."
  fi
fi

if [ -n "${T3CODE_PROJECT_ROOT:-}" ]; then
  main_root=$(git_root "$T3CODE_PROJECT_ROOT") ||
    fail "T3CODE_PROJECT_ROOT is not a Git checkout: $T3CODE_PROJECT_ROOT"
else
  main_root=$(primary_worktree_root "$worktree_root") ||
    fail "could not resolve the primary checkout; set T3CODE_PROJECT_ROOT to its path."
fi

main_common_dir=$(git_common_dir "$main_root") || fail "could not resolve the primary repository."
if [ "$worktree_common_dir" != "$main_common_dir" ]; then
  fail "the current checkout and primary checkout are not from the same repository."
fi

if [ "$worktree_root" = "$main_root" ]; then
  printf 'Already in the primary checkout; nothing to set up.\n'
  exit 0
fi

for filename in "${ENV_FILES[@]}"; do
  source_path="$main_root/$filename"
  if [ -f "$source_path" ]; then
    continue
  fi

  if [ "$filename" = ".env" ]; then
    printf 'No .env in the primary checkout (%s).\n' "$main_root" >&2
    printf 'Create it there first: cp "%s/.env.example" "%s/.env"\n' "$main_root" "$main_root" >&2
  else
    printf 'No .env.local in the primary checkout (%s).\n' "$main_root" >&2
    printf 'Complete the first Convex setup there, then rerun this command: cd "%s" && bun x convex dev\n' \
      "$main_root" >&2
  fi
  exit 1
done

# Preflight every target so one conflict cannot leave a half-linked worktree.
for filename in "${ENV_FILES[@]}"; do
  source_path="$main_root/$filename"
  target_path="$worktree_root/$filename"

  if [ -L "$target_path" ]; then
    link_target=$(readlink "$target_path")
    if [ "$link_target" != "$source_path" ]; then
      fail "$target_path points to $link_target; remove it yourself if the primary file should replace it."
    fi
    continue
  fi

  if [ -e "$target_path" ]; then
    fail "$target_path already exists; move or remove it yourself before sharing the primary file."
  fi
done

for filename in "${ENV_FILES[@]}"; do
  source_path="$main_root/$filename"
  target_path="$worktree_root/$filename"
  if [ -L "$target_path" ]; then
    printf '%s is already linked; leaving it unchanged.\n' "$target_path"
  else
    ln -s "$source_path" "$target_path"
    printf 'Linked %s -> %s\n' "$target_path" "$source_path"
  fi
done

# Parse only dotenv assignments. Sourcing these files would execute arbitrary shell syntax.
missing_names=$(
  awk '
    function trim(value) {
      sub(/^[[:space:]]+/, "", value)
      sub(/[[:space:]]+$/, "", value)
      return value
    }

    BEGIN {
      single_quote = sprintf("%c", 39)
      required[1] = "GOOGLE_MAPS_API_KEY_ANDROID"
      required[2] = "GOOGLE_MAPS_API_KEY_IOS"
      required[3] = "EXPO_PUBLIC_CONVEX_URL"
      required[4] = "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"
      required[5] = "CONVEX_DEPLOYMENT"
    }

    {
      line = $0
      sub(/\r$/, "", line)
      line = trim(line)
      if (line == "" || line ~ /^#/) {
        next
      }

      separator = index(line, "=")
      if (separator == 0) {
        next
      }

      key = trim(substr(line, 1, separator - 1))
      sub(/^export[[:space:]]+/, "", key)
      value = trim(substr(line, separator + 1))
      if (value ~ /^#/) {
        value = ""
      } else {
        first_character = substr(value, 1, 1)
        empty_remainder = trim(substr(value, 3))
        if ((substr(value, 1, 2) == "\"\"" || substr(value, 1, 2) == single_quote single_quote) &&
            (empty_remainder == "" || empty_remainder ~ /^#/)) {
          value = ""
        } else if ((first_character == "\"" || first_character == single_quote) &&
                   substr(value, length(value), 1) == first_character) {
          value = trim(substr(value, 2, length(value) - 2))
        }
      }
      values[key] = value
    }

    END {
      for (required_index = 1; required_index <= 5; required_index += 1) {
        name = required[required_index]
        if (!(name in values) || values[name] == "") {
          print name
        }
      }
    }
  ' "$worktree_root/.env" "$worktree_root/.env.local"
)

if [ -n "$missing_names" ]; then
  printf 'Missing or empty required environment variables:\n' >&2
  while IFS= read -r name; do
    printf '  - %s\n' "$name" >&2
  done <<<"$missing_names"
  exit 1
fi

cd "$worktree_root"
bun install --frozen-lockfile
printf 'Worktree setup complete.\n'
