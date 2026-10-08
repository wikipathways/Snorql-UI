#!/bin/bash
# Injects environment variables into config.js (and the page <title>) at container start.
# Only top-level keys of window.SNORQL_CONFIG are touched: patterns are anchored to the
# 4-space indent, so nested keys with the same name are left alone. Keep each of these keys
# on a single line in config.js.

HTDOCS="/usr/local/apache2/htdocs"
CONFIG_FILE="$HTDOCS/assets/js/config.js"

# Escape a value for use inside a double-quoted JS string, then for the sed replacement.
js_string() {
  local v="${1//\\/\\\\}"
  v="${v//\"/\\\"}"
  printf '%s' "$v"
}
sed_escape() {
  printf '%s' "$1" | sed -e 's/[\\#&]/\\&/g'
}

# set_string KEY VALUE -> KEY: "VALUE"
set_string() {
  local value
  value=$(sed_escape "$(js_string "$2")")
  sed -i "s#^\(    $1: \)\".*\"#\1\"${value}\"#" "$CONFIG_FILE"
}

# set_raw KEY VALUE -> KEY: VALUE (numbers, booleans, or an already-quoted literal)
set_raw() {
  local value
  value=$(sed_escape "$2")
  sed -i "s#^\(    $1: \)[^,]*#\1${value}#" "$CONFIG_FILE"
}

if [[ -n "${SNORQL_ENDPOINT}" ]]; then
  set_string endpoint "${SNORQL_ENDPOINT}"
else
  echo "SNORQL_ENDPOINT is not set"
fi

if [[ -n "${SNORQL_EXAMPLES_REPO}" ]]; then
  set_string examplesRepo "${SNORQL_EXAMPLES_REPO}"
else
  echo "SNORQL_EXAMPLES_REPO is not set"
fi

if [[ -n "${SNORQL_EXAMPLES_BRANCH}" ]]; then
  set_string examplesBranch "${SNORQL_EXAMPLES_BRANCH}"
fi

if [[ -n "${DEFAULT_GRAPH}" ]]; then
  set_string defaultGraph "${DEFAULT_GRAPH}"
else
  echo "DEFAULT_GRAPH is not set, using empty string"
fi

if [[ -n "${SNORQL_TITLE}" ]]; then
  set_string title "${SNORQL_TITLE}"
  title_html=$(sed_escape "$(printf '%s' "${SNORQL_TITLE}" | sed -e 's/&/\&amp;/g' -e 's/</\&lt;/g' -e 's/>/\&gt;/g')")
  sed -i "s#<title>.*</title>#<title>${title_html}</title>#g" "$HTDOCS/index.html"
else
  echo "SNORQL_TITLE is not set"
fi

if [[ -n "${WELCOME_TITLE}" ]]; then
  set_string welcomeTitle "${WELCOME_TITLE}"
fi

if [[ -n "${WELCOME_MESSAGE}" ]]; then
  set_string welcomeMessage "${WELCOME_MESSAGE}"
fi

if [[ -n "${SNORQL_QUERY_TIMEOUT_MS}" ]]; then
  if [[ "${SNORQL_QUERY_TIMEOUT_MS}" =~ ^[0-9]+$ ]]; then
    set_raw queryTimeoutMs "${SNORQL_QUERY_TIMEOUT_MS}"
  else
    echo "SNORQL_QUERY_TIMEOUT_MS must be a number, ignored"
  fi
fi

if [[ -n "${SNORQL_MAX_GET_URL_BYTES}" ]]; then
  if [[ "${SNORQL_MAX_GET_URL_BYTES}" =~ ^[0-9]+$ ]]; then
    set_raw maxGetUrlBytes "${SNORQL_MAX_GET_URL_BYTES}"
  else
    echo "SNORQL_MAX_GET_URL_BYTES must be a number, ignored"
  fi
fi

if [[ -n "${SNORQL_SEND_PREFIX_BLOCK}" ]]; then
  case "${SNORQL_SEND_PREFIX_BLOCK}" in
    auto) set_raw sendPrefixBlock "'auto'" ;;
    true|false) set_raw sendPrefixBlock "${SNORQL_SEND_PREFIX_BLOCK}" ;;
    *) echo "SNORQL_SEND_PREFIX_BLOCK must be auto, true or false, ignored" ;;
  esac
fi

# Set-but-empty disables link shortening, so test for "is set" rather than "non-empty".
if [[ -v SNORQL_BITLY_TOKEN ]]; then
  set_string bitlyToken "${SNORQL_BITLY_TOKEN}"
fi
