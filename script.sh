#!/bin/bash

CONFIG_FILE="/usr/local/apache2/htdocs/assets/js/config.js"

if [[ -n "${SNORQL_ENDPOINT}" ]]; then
  sed -i "s#endpoint: \".*\"#endpoint: \"${SNORQL_ENDPOINT}\"#" "$CONFIG_FILE"
else
  echo "SNORQL_ENDPOINT is not set"
fi

if [[ -n "${SNORQL_EXAMPLES_REPO}" ]]; then
  sed -i "s#examplesRepo: \".*\"#examplesRepo: \"${SNORQL_EXAMPLES_REPO}\"#" "$CONFIG_FILE"
else
  echo "SNORQL_EXAMPLES_REPO is not set"
fi

if [[ -n "${DEFAULT_GRAPH}" ]]; then
  sed -i "s#defaultGraph: \".*\"#defaultGraph: \"${DEFAULT_GRAPH}\"#" "$CONFIG_FILE"
else
  echo "DEFAULT_GRAPH is not set, using empty string"
fi

if [[ -n "${SNORQL_TITLE}" ]]; then
  sed -i "s#title: \".*\"#title: \"${SNORQL_TITLE}\"#" "$CONFIG_FILE"
  sed -i "s#<title>.*</title>#<title>${SNORQL_TITLE}</title>#g" /usr/local/apache2/htdocs/index.html
else
  echo "SNORQL_TITLE is not set"
fi

if [[ -n "${WELCOME_TITLE}" ]]; then
  sed -i "s#welcomeTitle: \".*\"#welcomeTitle: \"${WELCOME_TITLE}\"#" "$CONFIG_FILE"
fi

if [[ -n "${WELCOME_MESSAGE}" ]]; then
  sed -i "s#welcomeMessage: \".*\"#welcomeMessage: \"${WELCOME_MESSAGE}\"#" "$CONFIG_FILE"
fi
