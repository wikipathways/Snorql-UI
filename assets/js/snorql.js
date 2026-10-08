var CONFIG = window.SNORQL_CONFIG;
var _fullTreeData = null;
var _paramMode = false;
var _paramIgnoreChange = false;
var _currentTemplate = null;
var _currentParams = null;
var _currentParsedTitle = null; // Raw Mustache title template from #title header
var _panelState = 'welcome'; // 'welcome' | 'active' | 'stale'

function showWelcomePanel() {
    _panelState = 'welcome';
    $('#desc-title').text(CONFIG.welcomeTitle || 'SPARQL Query Explorer');
    $('#desc-text').html(CONFIG.welcomeMessage || '<p>Browse and run SPARQL queries.</p>');
    $('.stale-indicator').hide();
    $('#desc-params').hide();
    $('#desc-param-divider').hide();
    $('#description-panel').removeClass('panel-stale').css('opacity', 1);
}

function showQueryPanel(parsed) {
    _panelState = 'active';
    if (parsed.title && _currentParams && _currentParams.length > 0) {
        // Render title with default param values (D-01, D-02)
        var titleView = {};
        for (var i = 0; i < _currentParams.length; i++) {
            titleView[_currentParams[i].name] = _currentParams[i].defaultValue || '';
        }
        $('#desc-title').text(Mustache.render(parsed.title, titleView));
    } else {
        $('#desc-title').text(parsed.title || 'Query');
    }
    $('#desc-text').text(parsed.description || '');
    $('.stale-indicator').hide();
    $('#description-panel').removeClass('panel-stale').css('opacity', 1);
    // Enable param inputs if any exist
    $('#desc-params .param-input').prop('disabled', false);
}

function dimPanel() {
    if (_panelState !== 'active') return; // Only dim from active state
    _panelState = 'stale';
    $('#description-panel').addClass('panel-stale');
    $('.stale-indicator').show();
    // Disable param inputs per D-17
    $('#desc-params .param-input').prop('disabled', true);
}
var _autocompleteCache = {};
var _autocompleteCachePromise = {};

function findGetParameter(parameterName) {
    var result = null,
        tmp = [];
    location.search
        .substr(1)
        .split("&")
        .forEach(function (item) {
          tmp = item.split("=");
          if (tmp[0] === parameterName) result = decodeURIComponent(tmp[1]);
        });
    return result;
}

function changeEndpoint() {
    _autocompleteCache = {};
    _autocompleteCachePromise = {};
    checkEndpointHealth();
}

function changeExamplesRepo() {

    // Changes are temporary (session only)
}

// ---- Phase 9 — RELIAB-01: PREFIX block delivery ----
// Detect inline PREFIX declarations in the user's query so we don't
// double-declare on strict endpoints (Stardog, GraphDB, Fuseki).
// Regex per CONTEXT decision 1: matches "PREFIX foo:" at the start of a line.
function getInlineDeclaredPrefixes(query) {
    var declared = {};
    var re = /^\s*PREFIX\s+(\w+):/gim;
    var m;
    while ((m = re.exec(query)) !== null) {
        declared[m[1]] = true;
    }
    return declared;
}

// Strip string literals from a SPARQL query body so prefix-token scanning
// does not match `cur:label` inside `"..."`, `'...'`, `"""..."""`, or
// `'''...'''`. We replace each literal with a same-length run of spaces to
// preserve offsets. Order matters: triple-quoted forms must be matched
// BEFORE single-quoted forms.
function stripSparqlStringLiterals(query) {
    return query
        .replace(/"""[\s\S]*?"""/g, function(s) { return s.replace(/[^\n]/g, ' '); })
        .replace(/'''[\s\S]*?'''/g, function(s) { return s.replace(/[^\n]/g, ' '); })
        .replace(/"(?:\\.|[^"\\])*"/g, function(s) { return s.replace(/[^\n]/g, ' '); })
        .replace(/'(?:\\.|[^'\\])*'/g, function(s) { return s.replace(/[^\n]/g, ' '); });
}

// Find every `prefix:localname` token used in the query body (outside literals).
// Returns an object map { prefixName: true }.
function getUsedPrefixes(query) {
    var stripped = stripSparqlStringLiterals(query);
    var used = {};
    var re = /\b([A-Za-z_][\w-]*):[A-Za-z_]/g;
    var m;
    while ((m = re.exec(stripped)) !== null) {
        used[m[1]] = true;
    }
    return used;
}

// Build a PREFIX preamble of every CONFIG.namespaces entry not already
// declared inline. Used by sendPrefixBlock === true (force mode).
function buildAllMissingPrefixes(query) {
    var declared = getInlineDeclaredPrefixes(query);
    var preamble = '';
    for (var p in CONFIG.namespaces) {
        if (!declared[p]) {
            preamble += 'PREFIX ' + p + ': <' + CONFIG.namespaces[p] + '>\n';
        }
    }
    return preamble;
}

// Build a PREFIX preamble of every CONFIG.namespaces entry that is BOTH
// referenced by the query AND not already declared inline.
// Used by sendPrefixBlock === 'auto' (default).
function buildUsedPrefixes(query) {
    var declared = getInlineDeclaredPrefixes(query);
    var used = getUsedPrefixes(query);
    var preamble = '';
    for (var p in CONFIG.namespaces) {
        if (used[p] && !declared[p]) {
            preamble += 'PREFIX ' + p + ': <' + CONFIG.namespaces[p] + '>\n';
        }
    }
    return preamble;
}

// Public entry point: takes the user's raw query and returns the
// to-send query with the appropriate PREFIX preamble prepended,
// honoring CONFIG.sendPrefixBlock ('auto' | true | false).
function prepareQueryForSend(rawQuery) {
    var mode = (window.SNORQL_CONFIG && window.SNORQL_CONFIG.sendPrefixBlock !== undefined)
        ? window.SNORQL_CONFIG.sendPrefixBlock
        : 'auto';
    if (mode === false) return rawQuery;
    var preamble = (mode === true)
        ? buildAllMissingPrefixes(rawQuery)
        : buildUsedPrefixes(rawQuery);
    return preamble + rawQuery;
}

// Mode-aware backwards-compat shim. The original getPrefixes() (snorql.js:74-82,
// pre-Phase-9) returned ALL CONFIG.namespaces entries unconditionally and
// leaked `prefixes` and `prefix` as globals. The 5 callers in script.js
// (lines 26, 122, 128, 134, 175) assigned the result to a `queryText`
// variable that was never sent. Plan 03 removes those assignments.
//
// PER PLAN-CHECKER W-7 (Option a — chosen for cleaner semantics):
// the shim now ALIASES prepareQueryForSend so any external fork still
// calling getPrefixes(query) honors the configured sendPrefixBlock mode
// instead of silently bypassing it. Callers passing no argument get the
// preamble for an empty query — the safest no-op fallback.
//
// Note: the shim now returns the FULL prefixed query (preamble + rawQuery),
// not the bare preamble that the pre-Phase-9 helper returned. This is a
// deliberate semantic change: the pre-Phase-9 callers were broken (they
// concatenated again with `+ query`, double-prepending). The 5 in-tree
// callers are removed by Task 2; any external caller picking up this shim
// gets the correct, modal-respecting prefixed query without further work.
function getPrefixes(query) {
    var q = (typeof query === 'string') ? query : '';
    return prepareQueryForSend(q);
}

// ---- Phase 9 — RELIAB-03: GET → POST length switch ----
// Returns 'POST' when the URL-encoded prefixed query plus endpoint plus
// standard query-string parameters would exceed CONFIG.maxGetUrlBytes
// (default 4000 bytes — well under nginx 8K and Cloudflare 8K limits).
// Returns 'GET' otherwise. Per CONTEXT decision 4, the threshold is
// computed against the PREFIXED query (output of prepareQueryForSend),
// not the raw user query — otherwise the threshold leaks ~50–250 bytes.
//
// The single threshold (CONFIG.maxGetUrlBytes) gates BOTH the method switch
// and Plan 06's permalink refusal — one mental model for the user.
function chooseMethod(endpoint, prefixedQuery) {
    var maxBytes = (window.SNORQL_CONFIG && window.SNORQL_CONFIG.maxGetUrlBytes) || 4000;
    var defaultGraph = (window.SNORQL_CONFIG && window.SNORQL_CONFIG.defaultGraph) || '';
    var dgPart = defaultGraph ? ('&default-graph-uri=' + encodeURIComponent(defaultGraph)) : '';
    var estimated = endpoint.length
                  + '?query='.length
                  + encodeURIComponent(prefixedQuery).length
                  + '&output=json'.length
                  + dgPart.length;
    return estimated > maxBytes ? 'POST' : 'GET';
}

function parseRqHeaders(content) {
    var result = { title: null, description: null, params: [] };

    var lines = content.split('\n');
    var descriptionLines = [];

    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();

        var titleMatch = line.match(/^#\s*title:\s*(.+)/i);
        if (titleMatch) {
            result.title = titleMatch[1].trim();
            continue;
        }

        var descMatch = line.match(/^#\s*description:\s*(.+)/i);
        if (descMatch) {
            descriptionLines.push(descMatch[1].trim());
            continue;
        }

        // Continuation line: "#   some text" (indented, no keyword)
        if (descriptionLines.length > 0 && line.match(/^#\s{2,}\S/)) {
            descriptionLines.push(line.replace(/^#\s+/, ''));
            continue;
        }

        var paramMatch = line.match(/^#\s*param:\s*(.+)/i);
        if (paramMatch) {
            var parts = paramMatch[1].split('|');
            if (parts.length >= 4) {
                var paramName = parts[0].trim();
                var paramType = parts[1].trim();
                var paramDefault = parts[2].trim();
                var paramLabel = parts[3].trim();
                var paramOptions = null;
                var autocompleteTypeName = null;

                if (paramType.indexOf('autocomplete:') === 0) {
                    autocompleteTypeName = paramType.substring(13).trim();
                    paramType = 'autocomplete';
                } else if (paramType.indexOf('enum:') === 0) {
                    var rawOptions = paramType.substring(5).split(',').map(function(o) { return o.trim(); });
                    paramOptions = rawOptions.map(function(o) {
                        var eqIdx = o.indexOf('=');
                        if (eqIdx > 0) {
                            return { value: o.substring(0, eqIdx), label: o.substring(eqIdx + 1) };
                        }
                        return { value: o, label: o };
                    });
                    paramType = 'enum';
                }

                result.params.push({
                    name: paramName,
                    type: paramType,
                    autocompleteType: autocompleteTypeName,
                    defaultValue: paramDefault,
                    label: paramLabel,
                    options: paramOptions
                });
            }
            continue;
        }
    }

    if (descriptionLines.length > 0) {
        result.description = descriptionLines.join(' ');
    }

    return result;
}

function sanitizeSparqlString(value) {
    return value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
}

function sanitizeSparqlUri(value) {
    // Strip leading < and trailing > if present
    value = value.replace(/^</, '').replace(/>$/, '');
    // Reject if contains forbidden characters
    if (/[<>"{}|^`\\\s]/.test(value)) {
        return '';
    }
    return value;
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function sanitizeEnumValue(value, allowedOptions) {
    if (!allowedOptions) return null;
    for (var i = 0; i < allowedOptions.length; i++) {
        if (allowedOptions[i].value === value) return value;
    }
    return null;
}

// Resolve the value to substitute for a param. Autocomplete fields show a
// friendly "ID — Title" label but must substitute only the bare ID, so the
// chosen ID is stashed in a data-selected-value attribute. Precedence:
//   1. data-selected-value (set when the user picks from the dropdown)
//   2. the leading token of the field text, split on the " — " separator
//      (handles free-typed input; the em dash is safe for hyphenated IDs
//      such as CAS numbers like "100-42-5")
//   3. the raw field value
//   4. the param default
function readParamValue(param) {
    var el = document.getElementById('param-' + param.name);
    if (!el) return param.defaultValue;
    var sel = el.getAttribute ? el.getAttribute('data-selected-value') : null;
    if (sel !== null && sel !== '') return sel;
    var raw = (el.value || '').trim();
    if (raw === '') return param.defaultValue;
    return raw.split(' — ')[0].trim() || raw;
}

function substituteParams(templateContent, params) {
    var view = {};
    for (var i = 0; i < params.length; i++) {
        var param = params[i];
        var value = readParamValue(param);

        if (param.type === 'string') {
            view[param.name] = sanitizeSparqlString(value);
        } else if (param.type === 'uri') {
            var sanitized = sanitizeSparqlUri(value);
            view[param.name] = sanitized || sanitizeSparqlUri(param.defaultValue) || param.defaultValue;
        } else if (param.type === 'enum') {
            var enumVal = sanitizeEnumValue(value, param.options);
            view[param.name] = enumVal !== null ? enumVal : param.defaultValue;
        } else if (param.type === 'autocomplete') {
            // A picked value is a bare id, which escaping leaves unchanged. Free-typed text is
            // escaped like a string param, so a quote cannot break the query.
            view[param.name] = sanitizeSparqlString(value);
        } else {
            view[param.name] = value;
        }
    }

    var originalEscape = Mustache.escape;
    Mustache.escape = function(text) { return text; };
    var rendered = Mustache.render(templateContent, view);
    Mustache.escape = originalEscape;

    return rendered;
}

function stripHeaders(content) {
    var lines = content.split('\n');
    var startIndex = 0;
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() === '' || lines[i].trim().charAt(0) === '#') {
            startIndex = i + 1;
        } else {
            break;
        }
    }
    return lines.slice(startIndex).join('\n');
}

function fetchAutocompleteData(typeName) {
    if (_autocompleteCache[typeName]) {
        return $.Deferred().resolve(_autocompleteCache[typeName]).promise();
    }
    if (_autocompleteCachePromise[typeName]) {
        return _autocompleteCachePromise[typeName];
    }

    var typeConfig = CONFIG.autocompleteTypes ? CONFIG.autocompleteTypes[typeName] : null;
    if (!typeConfig) {
        console.warn('Autocomplete type "' + typeName + '" not found in registry');
        return $.Deferred().resolve([]).promise();
    }

    // Static values - no SPARQL needed
    if (typeConfig.staticValues) {
        var list = typeConfig.staticValues.map(function(v) {
            var item = {};
            item[typeConfig.valueField] = v;
            return item;
        });
        _autocompleteCache[typeName] = list;
        return $.Deferred().resolve(list).promise();
    }

    // SPARQL fetch
    var endpoint = document.getElementById('endpoint').value.trim();
    var url = endpoint + '?query=' + encodeURIComponent(typeConfig.sparql) + '&output=json';

    var deferred = $.Deferred();
    $.ajax({ url: url, dataType: 'json' }).done(function(json) {
        var list = [];
        if (json && json.results && json.results.bindings) {
            for (var i = 0; i < json.results.bindings.length; i++) {
                var b = json.results.bindings[i];
                var item = {};
                item[typeConfig.valueField] = b[typeConfig.valueField] ? b[typeConfig.valueField].value : '';
                if (typeConfig.labelField && b[typeConfig.labelField]) {
                    item[typeConfig.labelField] = b[typeConfig.labelField].value;
                }
                if (typeConfig.extraField && b[typeConfig.extraField]) {
                    item[typeConfig.extraField] = b[typeConfig.extraField].value;
                }
                list.push(item);
            }
        }
        _autocompleteCache[typeName] = list;
        _autocompleteCachePromise[typeName] = null;
        deferred.resolve(list);
    }).fail(function() {
        _autocompleteCachePromise[typeName] = null;
        deferred.resolve([]);
    });

    _autocompleteCachePromise[typeName] = deferred.promise();
    return _autocompleteCachePromise[typeName];
}

function formatAutocompleteOption(item, typeConfig) {
    var value = item[typeConfig.valueField] || '';
    // Multi-field display (e.g., pathway: id + name + species)
    if (typeConfig.labelField && item[typeConfig.labelField]) {
        var label = item[typeConfig.labelField];
        var extra = (typeConfig.extraField && item[typeConfig.extraField])
            ? ' <span class="autocomplete-option-species">[' + escapeHtml(item[typeConfig.extraField]) + ']</span>'
            : '';
        return '<div class="autocomplete-option" data-value="' + escapeHtml(value) + '">' +
            '<span class="autocomplete-option-id">' + escapeHtml(value) + '</span> ' +
            '<span class="autocomplete-option-title">' + escapeHtml(label) + '</span>' +
            extra +
            '</div>';
    }
    // Single-field display (e.g., species, entityType, datasource)
    return '<div class="autocomplete-option" data-value="' + escapeHtml(value) + '">' +
        escapeHtml(value) +
        '</div>';
}

function initAutocompleteField(inputId, typeName) {
    var typeConfig = CONFIG.autocompleteTypes ? CONFIG.autocompleteTypes[typeName] : null;
    if (!typeConfig) {
        console.warn('Autocomplete type "' + typeName + '" not found in registry');
        return;
    }
    initAutocomplete(inputId, function(val, render) {
        fetchAutocompleteData(typeName).done(function(list) {
            var filtered = [];
            var lowerVal = val.toLowerCase();
            for (var i = 0; i < list.length; i++) {
                var item = list[i];
                // Search across all configured fields
                var match = false;
                if (item[typeConfig.valueField] && item[typeConfig.valueField].toLowerCase().indexOf(lowerVal) !== -1) match = true;
                if (!match && typeConfig.labelField && item[typeConfig.labelField] && item[typeConfig.labelField].toLowerCase().indexOf(lowerVal) !== -1) match = true;
                if (match) filtered.push(item);
            }
            render(filtered);
        });
    }, function(item) {
        return formatAutocompleteOption(item, typeConfig);
    });
    // Pre-fetch data so it is cached when user first types, and enrich the
    // default value (a bare ID) into a friendly "ID — Title" label when found.
    fetchAutocompleteData(typeName).done(function(list) {
        var $inp = $('#' + inputId);
        if (!$inp.length) return;
        var cur = ($inp.val() || '').trim();
        // Only enrich an untouched bare default (no selection, no separator).
        if (!cur || $inp.attr('data-selected-value') != null || cur.indexOf(' — ') !== -1) return;
        for (var i = 0; i < list.length; i++) {
            if (list[i][typeConfig.valueField] === cur) {
                var lbl = typeConfig.labelField ? list[i][typeConfig.labelField] : '';
                $inp.val(lbl ? cur + ' — ' + lbl : cur).attr('data-selected-value', cur);
                break;
            }
        }
    });
}

function initAutocomplete(inputId, fetchFn, formatFn) {
    var $input = $('#' + inputId);
    var $wrapper = $input.closest('.autocomplete-wrapper');
    var $dropdown = $wrapper.find('.autocomplete-dropdown');
    var highlightIndex = -1;

    function renderDropdown(items) {
        if (items.length === 0) {
            $dropdown.hide();
            return;
        }
        var html = '';
        var limit = Math.min(items.length, 50);
        for (var i = 0; i < limit; i++) {
            html += formatFn(items[i]);
        }
        if (items.length > 50) {
            html += '<div class="autocomplete-option-more">' + (items.length - 50) + ' more — keep typing to narrow</div>';
        }
        $dropdown.html(html).show();
        highlightIndex = -1;
    }

    function updateHighlight() {
        $dropdown.find('.autocomplete-option').removeClass('highlighted');
        if (highlightIndex >= 0) {
            var $opts = $dropdown.find('.autocomplete-option');
            if (highlightIndex < $opts.length) {
                $opts.eq(highlightIndex).addClass('highlighted');
                var opt = $opts[highlightIndex];
                if (opt.scrollIntoView) {
                    opt.scrollIntoView({ block: 'nearest' });
                }
            }
        }
    }

    function selectItem(value, label) {
        // Show a friendly "ID — Title" label but stash the bare ID so that
        // readParamValue substitutes only the ID into the query.
        $input.val(label ? value + ' — ' + label : value);
        $input.attr('data-selected-value', value);
        $dropdown.hide();
        highlightIndex = -1;
        $input.trigger('change');
    }

    $input.on('focus', function() {
        this.select();
    });

    $input.on('input', function() {
        // Typing invalidates any prior dropdown selection.
        $input.removeAttr('data-selected-value');
        var val = $input.val().trim().toLowerCase();
        if (!val) {
            $dropdown.hide();
            return;
        }
        fetchFn(val, renderDropdown);
    });

    $input.on('keydown', function(e) {
        if (!$dropdown.is(':visible')) return;
        var $opts = $dropdown.find('.autocomplete-option');
        if (e.keyCode === 40) { // Down
            e.preventDefault();
            highlightIndex = Math.min(highlightIndex + 1, $opts.length - 1);
            updateHighlight();
        } else if (e.keyCode === 38) { // Up
            e.preventDefault();
            highlightIndex = Math.max(highlightIndex - 1, 0);
            updateHighlight();
        } else if (e.keyCode === 13) { // Enter
            e.preventDefault();
            if (highlightIndex >= 0 && highlightIndex < $opts.length) {
                var $opt = $opts.eq(highlightIndex);
                selectItem($opt.attr('data-value'), $opt.find('.autocomplete-option-title').text());
            }
        } else if (e.keyCode === 27) { // Escape
            $dropdown.hide();
            highlightIndex = -1;
        }
    });

    $dropdown.on('click', '.autocomplete-option', function() {
        var $o = $(this);
        selectItem($o.attr('data-value'), $o.find('.autocomplete-option-title').text());
    });

    // Use namespaced event to avoid accumulating handlers across rebuilds
    var ns = '.ac-' + inputId;
    $(document).off('mousedown' + ns).on('mousedown' + ns, function(e) {
        if (!$(e.target).closest('.autocomplete-wrapper').length) {
            $dropdown.hide();
            highlightIndex = -1;
        }
    });
}

// Legacy name-to-type map for .rq files not yet migrated to autocomplete: syntax
var _legacyAutocompleteNames = {
    'pathwayId': 'pathway',
    'species': 'species'
};

function resolveAutocompleteType(param) {
    if (param.autocompleteType) return param.autocompleteType;
    return _legacyAutocompleteNames[param.name] || null;
}

function buildParamPanel(params, templateContent) {
    var $panel = $('#desc-params');
    var html = '<div class="param-row">';

    for (var i = 0; i < params.length; i++) {
        var p = params[i];
        var acType = resolveAutocompleteType(p);
        html += '<div class="param-item">';
        html += '<label for="param-' + p.name + '">' + p.label + '</label> ';

        if (p.type === 'enum' && p.options) {
            html += '<select class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '">';
            for (var j = 0; j < p.options.length; j++) {
                var opt = p.options[j];
                var selected = (opt.value === p.defaultValue) ? ' selected' : '';
                html += '<option value="' + opt.value + '"' + selected + '>' + escapeHtml(opt.label) + '</option>';
            }
            html += '</select>';
        } else if (acType) {
            var typeConfig = CONFIG.autocompleteTypes ? CONFIG.autocompleteTypes[acType] : null;
            var placeholder = typeConfig ? typeConfig.placeholder : p.label;
            html += '<div class="autocomplete-wrapper">';
            html += '<input type="text" class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '" value="' + escapeHtml(p.defaultValue) + '" placeholder="' + escapeHtml(placeholder) + '" autocomplete="off">';
            html += '<div class="autocomplete-dropdown"></div>';
            html += '</div>';
        } else {
            html += '<input type="text" class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '" value="' + p.defaultValue + '" placeholder="' + p.label + '">';
        }

        html += '</div>';
    }

    html += '</div>';
    $panel.html(html);

    // Initialize autocomplete fields by type or legacy name fallback
    for (var k = 0; k < params.length; k++) {
        var acTypeName = resolveAutocompleteType(params[k]);
        if (acTypeName) {
            initAutocompleteField('param-' + params[k].name, acTypeName);
        }
    }

    // Trigger initial substitution with defaults
    var substituted = substituteParams(templateContent, params);
    var body = stripHeaders(substituted);
    _paramIgnoreChange = true;
    editor.getDoc().setValue(body);
    _paramIgnoreChange = false;
}

function cleanFilename(filename) {
    return filename
        .replace(/\.rq$/, '')
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, function(c) { return c.toUpperCase(); });
}

var CACHE_KEY_PREFIX = 'snorql_examples_';

function getCachedExamples(repoUrl) {
    try {
        var data = sessionStorage.getItem(CACHE_KEY_PREFIX + repoUrl);
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
}

function setCachedExamples(repoUrl, treeData) {
    try {
        sessionStorage.setItem(CACHE_KEY_PREFIX + repoUrl, JSON.stringify(treeData));
    } catch (e) { /* silently continue */ }
}

function mainAjax(link, repo) {
    var tree = [];
    var deferred = $.Deferred();

    jQuery.ajax({
        url: link,
        dataType: 'json'
    }).done(function(results) {
        results = results["tree"];

        for (var i = 0; i < results.length; i++) {
            var segments = results[i]["path"].split("/");
            var path = results[i]["path"];

            if (path.slice(path.length - 2) == "rq") {
                var node = new Object();

                if (segments.length == 1) {
                    node.text = segments[0];
                    node.originalFilename = segments[0];
                    node.href = repo.includes("http://localhost")
                        ? repo.replace("/api/repos/", "/raw/") + "/" + path
                        : "https://raw.githubusercontent.com/" + repo + "/" + examplesBranch() + "/" + path;
                    node.icon = 'glyphicon glyphicon-file';
                    tree.push(node);

                } else if (segments.length == 2) {
                    var index = getIndexFromTree(segments[0], tree);

                    if (index == null) {
                        var folder_node = new Object();
                        folder_node.text = segments[0];
                        folder_node.nodes = new Array();
                        folder_node.href = "#";
                        tree.push(folder_node);
                        index = getIndexFromTree(segments[0], tree);
                    }

                    node.text = segments[1];
                    node.originalFilename = segments[1];
                    node.href = repo.includes("http://localhost")
                        ? repo.replace("/api/repos/", "/raw/") + "/" + path
                        : "https://raw.githubusercontent.com/" + repo + "/" + examplesBranch() + "/" + path;
                    node.icon = 'glyphicon glyphicon-file';
                    tree[index].nodes.push(node);

                } else if (segments.length == 3) {
                    var index = getIndexFromTree(segments[0], tree);

                    if (index == null) {
                        var folder_node = new Object();
                        folder_node.text = segments[0];
                        folder_node.nodes = new Array();
                        folder_node.href = "#";
                        tree.push(folder_node);
                        index = getIndexFromTree(segments[0], tree);
                    }

                    var index2 = getIndexFromTree(segments[1], tree[index].nodes);

                    if (index2 == null) {
                        var folder_node = new Object();
                        folder_node.text = segments[1];
                        folder_node.nodes = new Array();
                        folder_node.href = "#";
                        tree[index].nodes.push(folder_node);
                        index2 = getIndexFromTree(segments[1], tree[index].nodes);
                    }

                    node.text = segments[2];
                    node.originalFilename = segments[2];
                    node.href = repo.includes("http://localhost")
                        ? repo.replace("/api/repos/", "/raw/") + "/" + path
                        : "https://raw.githubusercontent.com/" + repo + "/" + examplesBranch() + "/" + path;
                    node.icon = 'glyphicon glyphicon-file';
                    tree[index].nodes[index2].nodes.push(node);
                }
            }
        }

        deferred.resolve(tree);
    }).fail(function(xhr) {
        deferred.reject(xhr);
    });

    return deferred.promise();
}

function getIndexFromTree(segment, nodes) {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].text == segment) {
            return i;
        }
    }
    return null;
}

function collectLeafNodes(nodes, leaves) {
    for (var i = 0; i < nodes.length; i++) {
        if (nodes[i].href && (nodes[i].href.indexOf("raw.githubusercontent.com") !== -1 || nodes[i].href.indexOf("/raw/") !== -1)) {
            leaves.push(nodes[i]);
        }
        if (nodes[i].nodes) {
            collectLeafNodes(nodes[i].nodes, leaves);
        }
    }
}

function enrichTreeWithMetadata(tree) {
    var leaves = [];
    collectLeafNodes(tree, leaves);

    if (leaves.length === 0) {
        return $.Deferred().resolve(tree).promise();
    }

    var promises = leaves.map(function(node) {
        return $.ajax({
            url: node.href,
            dataType: 'text'
        }).then(function(content) {
            var meta = parseRqHeaders(content);
            node.text = meta.title || cleanFilename(node.originalFilename || node.text);
            node.description = meta.description || '';
            node.queryContent = content;
            return node;
        }, function() {
            // If individual file fetch fails, use cleaned filename
            node.text = cleanFilename(node.originalFilename || node.text);
            node.description = '';
            node.queryContent = null;
            return node;
        });
    });

    return $.when.apply($, promises).then(function() {
        return tree;
    });
}

function filterTreeBySearch(nodes, lowerPattern) {
    var result = [];
    nodes.forEach(function(node) {
        if (node.nodes) {
            var filteredChildren = filterTreeBySearch(node.nodes, lowerPattern);
            if (filteredChildren.length > 0) {
                var folderCopy = JSON.parse(JSON.stringify(node));
                folderCopy.nodes = filteredChildren;
                result.push(folderCopy);
            }
        } else {
            var matches = false;
            if (node.text && node.text.toLowerCase().indexOf(lowerPattern) !== -1) matches = true;
            if (!matches && node.description && node.description.toLowerCase().indexOf(lowerPattern) !== -1) matches = true;
            if (matches) {
                result.push(JSON.parse(JSON.stringify(node)));
            }
        }
    });
    return result;
}

function searchExamples(pattern, suffix) {
    if (!pattern || !_fullTreeData) return;

    var lowerPattern = pattern.toLowerCase();
    var filtered = filterTreeBySearch(_fullTreeData, lowerPattern);

    initTreeview(filtered, suffix);
}

function initTreeview(tree, suffix) {
    $('#examples' + suffix).treeview({
        data: tree,
        levels: 0,
        expandIcon: 'glyphicon glyphicon-folder-close',
        collapseIcon: 'glyphicon glyphicon-folder-open',
        onNodeSelected: function(event, node) {
            if (node.href && (node.href.indexOf("raw.githubusercontent.com") !== -1 || node.href.indexOf("/raw/") !== -1)) {
                var updateUrl = function(content) {
                    var queryEncoded = "?q=" + encodeURIComponent(content) + "&endpoint=" + encodeURIComponent(jQuery("#endpoint").val().trim());
                    var url = window.location.href.split('?')[0] + queryEncoded;
                    window.history.replaceState(null, "", url);
                };
                var handleContent = function(content) {
                    var parsed = parseRqHeaders(content);

                    // Set template state BEFORE showQueryPanel so title can render with defaults
                    if (parsed.params.length > 0) {
                        _currentTemplate = content;
                        _currentParams = parsed.params;
                        _currentParsedTitle = parsed.title; // Cache raw title for re-rendering
                    } else {
                        _currentTemplate = null;
                        _currentParams = null;
                        _currentParsedTitle = null;
                    }

                    showQueryPanel(parsed);

                    if (parsed.params.length > 0) {
                        _paramMode = true;
                        buildParamPanel(parsed.params, content);
                        // Show param section
                        $('#desc-param-divider').show();
                        $('#desc-params').show();
                        var substituted = substituteParams(content, parsed.params);
                        var body = stripHeaders(substituted);
                        updateUrl(body);
                    } else {
                        _paramMode = false;
                        // Hide param section
                        $('#desc-param-divider').hide();
                        $('#desc-params').hide();
                        var body = stripHeaders(content);
                        _paramIgnoreChange = true;
                        editor.getDoc().setValue(body);
                        _paramIgnoreChange = false;
                        updateUrl(body);
                    }
                };
                if (node.queryContent) {
                    handleContent(node.queryContent);
                } else {
                    jQuery.ajax({
                        url: node.href,
                        dataType: 'text',
                        success: function(response) {
                            handleContent(response);
                        }
                    });
                }
            } else {
                $('#examples' + suffix).treeview('toggleNodeExpanded', [node.nodeId, { silent: true }]);
            }
        }
    });

    // Initialize Bootstrap popovers for nodes with descriptions
    $('#examples' + suffix + ' .list-group-item').each(function() {
        var nodeId = $(this).data('nodeid');
        var node = $('#examples' + suffix).treeview('getNode', nodeId);
        if (node && node.description) {
            $(this).popover({
                content: node.description,
                trigger: 'hover',
                placement: 'left',
                container: 'body'
            });
        }
    });
}

// Branch of the examples repository to read .rq files from (CONFIG.examplesBranch).
function examplesBranch() {
    var b = window.SNORQL_CONFIG && window.SNORQL_CONFIG.examplesBranch;
    return b ? String(b) : 'master';
}

function fetchExamples(suffix) {
    if (typeof suffix === 'undefined') suffix = '';

    var repo = jQuery("#examples-repo").val();

    if (repo.charAt(repo.length - 1) == "/") {
        repo = repo.substring(0, repo.length - 1);
    }

    if (!repo || (!repo.includes("https://github.com") && !repo.includes("http://localhost"))) {
        return;
    }

    // Check cache first
    var cached = getCachedExamples(repo);
    if (cached) {
        _fullTreeData = JSON.parse(JSON.stringify(cached));
        initTreeview(cached, suffix);
        return;
    }

    var repoPath = repo.substring(19);
    var link = repo.includes("http://localhost")
        ? repo + "/git/trees/" + examplesBranch() + "?recursive=1"
        : "https://api.github.com/repos/" + repoPath + "/git/trees/" + examplesBranch() + "?recursive=1";

    mainAjax(link, repo.includes("http://localhost") ? repo : repoPath).then(function(tree) {
        return enrichTreeWithMetadata(tree);
    }).then(function(enrichedTree) {
        setCachedExamples(repo, enrichedTree);
        _fullTreeData = JSON.parse(JSON.stringify(enrichedTree));
        initTreeview(enrichedTree, suffix);
    }).fail(function(xhr) {
        var message = 'Could not load examples.';
        if (xhr.status === 403) {
            message = 'GitHub rate limit reached, try again later.';
        } else if (xhr.status === 404) {
            message = 'Examples repository not found. Please check the URL.';
        }
        $('#examples' + suffix).html(
            '<div class="alert alert-warning" style="margin:10px;">' +
            '<strong>Note:</strong> ' + message +
            '</div>'
        );
    });
}

function setHealthDot(state, message) {
    var $dot = $('#endpoint-health-dot');
    $dot.removeClass('dot-checking dot-green dot-amber dot-red');
    $dot.addClass('dot-' + state);
    $dot.attr('data-original-title', message).tooltip('fixTitle');
}

function checkEndpointHealth() {
    var endpoint = document.getElementById('endpoint').value.trim();
    if (!endpoint) {
        setHealthDot('red', 'No endpoint configured');
        return;
    }

    setHealthDot('checking', 'Checking endpoint...');

    var timedOut = false;
    var xhr = new XMLHttpRequest();
    var url = endpoint + '?query=' + encodeURIComponent('ASK { ?s ?p ?o }') + '&output=json';

    var timeoutId = setTimeout(function() {
        timedOut = true;
        xhr.abort();
        setHealthDot('red', 'Endpoint unreachable \u2014 check URL or server status');
    }, 5000);

    xhr.onreadystatechange = function() {
        if (xhr.readyState !== 4) return;
        clearTimeout(timeoutId);
        if (timedOut) return;

        if (xhr.status >= 200 && xhr.status <= 299) {
            setHealthDot('green', 'Endpoint connected');
        } else if (xhr.status === 0) {
            setHealthDot('amber', 'Endpoint may be reachable but blocks browser requests (CORS)');
        } else {
            setHealthDot('red', 'Endpoint unreachable \u2014 check URL or server status');
        }
    };

    try {
        xhr.open('GET', url, true);
        xhr.send();
    } catch (e) {
        clearTimeout(timeoutId);
        setHealthDot('red', 'Endpoint unreachable \u2014 check URL or server status');
    }
}

function start(){
    // Priority: URL parameter > configured default
    var getvar_endpoint = findGetParameter("endpoint");
    if (getvar_endpoint != null) {
        document.getElementById("endpoint").value = getvar_endpoint;
    } else {
        document.getElementById('endpoint').value = CONFIG.endpoint;
    }

    // Examples repo: use configured default
    document.getElementById('examples-repo').value = CONFIG.examplesRepo;

    fetchExamples();
    fetchExamples("-fs");

    $('#poweredby').attr('href', CONFIG.poweredByLink);
    $('#poweredby').text( CONFIG.poweredByLabel);

    // Live preview: update editor as user types in parameter fields
    $('#desc-params').on('input change', '.param-input', function() {
        if (_currentTemplate && _currentParams) {
            // Dynamic title update (TMPL-07, D-03)
            if (_currentParsedTitle) {
                var titleView = {};
                for (var i = 0; i < _currentParams.length; i++) {
                    var p = _currentParams[i];
                    titleView[p.name] = readParamValue(p);
                }
                $('#desc-title').text(Mustache.render(_currentParsedTitle, titleView));
            }

            // Existing query body substitution (unchanged)
            var substituted = substituteParams(_currentTemplate, _currentParams);
            var body = stripHeaders(substituted);
            _paramIgnoreChange = true;
            editor.getDoc().setValue(body);
            _paramIgnoreChange = false;
            // Update URL with substituted query
            var queryEncoded = "?q=" + encodeURIComponent(body) + "&endpoint=" + encodeURIComponent(jQuery("#endpoint").val().trim());
            var url = window.location.href.split('?')[0] + queryEncoded;
            window.history.replaceState(null, "", url);
        }
    });

    // Manual edit detection: dim description panel when user edits the query directly
    editor.on('change', function(cm, changeObj) {
        if (_paramIgnoreChange) return;
        if (changeObj.origin !== 'setValue' && _panelState === 'active') {
            dimPanel();
            // Clear template state so params don't re-fire
            _paramMode = false;
            _currentTemplate = null;
            _currentParams = null;
        }
    });

    // Initialize endpoint health indicator
    $('#endpoint-health-dot').tooltip({ placement: 'bottom', trigger: 'hover' });
    checkEndpointHealth();

    // Show welcome panel on page load (per D-09)
    showWelcomePanel();
}

function showQuerySpinner() {
    var spinner = document.createElement('div');
    spinner.className = 'query-spinner';
    spinner.innerHTML = '<div class="spinner"></div><p>Executing query...</p>';
    setResult(spinner);
    $('#query-button').prop('disabled', true).val('Running...');
}

function hideQuerySpinner() {
    $('#query-button').prop('disabled', false).val('Query');
}

function doQuery(url, sparql, callback) {

    service = new SPARQL.Service(url);
    var _phase9Prefixed = prepareQueryForSend(sparql);   // RELIAB-03: compute once for chooseMethod + service.query (declare-once-reuse-twice)
    service.setMethod(chooseMethod(url, _phase9Prefixed));
    if (CONFIG.defaultGraph != "") {
        service.addDefaultGraph(CONFIG.defaultGraph);
    }

    service.setRequestHeader('Accept', 'application/sparql-results+json,*/*');
    service.setOutput('json');

    showQuerySpinner();
    service.query(_phase9Prefixed, {
            success: callback,
            failure: onFailure
    });
}

var SPARQL_ERROR_PATTERNS = [
    // ---- Phase 9 — RELIAB-02: status-code-driven friendly errors ----
    // These entries are matched BEFORE the body-pattern entries below.
    // Each carries a statusCodes:[..] array; onFailure (below) checks
    // statusCodes first, then falls through to body-pattern matching.
    {
        statusCodes: [504, 524],
        message: 'The connection to the SPARQL server timed out.',
        hint: 'The server may be busy. Try again, or simplify your query (add LIMIT, narrow filters).'
    },
    {
        statusCodes: [502],
        message: 'The SPARQL gateway returned a bad-gateway error.',
        hint: 'The endpoint may be down. Try again in a moment.'
    },
    {
        statusCodes: [503],
        message: 'The SPARQL server is temporarily unavailable.',
        hint: 'Try again in a moment.'
    },
    {
        statusCodes: [500],
        pattern: /transaction.*timed|timed.*out/i,
        message: 'The query took longer than the server allows.',
        hint: 'Try adding LIMIT, narrowing filters, or simplifying joins.'
    },
    {
        pattern: /Syntax error/i,
        message: 'There is a syntax error in your query. Check for missing brackets, quotes, or keywords.',
        hint: 'Common causes: unclosed brackets { }, missing periods between triple patterns, or typos in SPARQL keywords.'
    },
    {
        pattern: /Lexical error/i,
        message: 'There is a typo or invalid character in your query.',
        hint: 'Check for mismatched quotes, invalid prefixed names, or unexpected special characters.'
    },
    {
        pattern: /timed?\s*out|Transaction.*timed/i,
        message: 'The query took too long to complete.',
        hint: 'Try adding a LIMIT clause, narrowing your filters, or being more specific in your triple patterns.'
    },
    {
        pattern: /estimated execution time.*exceeds/i,
        message: 'The query is too complex for the server to process.',
        hint: 'Simplify your query by reducing the number of triple patterns or adding more specific filters.'
    },
    {
        pattern: /undefined prefix/i,
        message: 'The query uses a namespace prefix that is not defined.',
        hint: 'Add a PREFIX declaration at the top of your query for the undefined prefix.'
    },
    {
        pattern: /unresolved/i,
        message: 'The query references something the server cannot find.',
        hint: 'Check that all variable names are spelled correctly and all prefixes are defined.'
    },
    {
        pattern: /SPARQL.*not supported/i,
        message: 'This SPARQL feature is not supported by the endpoint.',
        hint: 'The server may not support all SPARQL 1.1 features. Try an alternative query approach.'
    },
    {
        pattern: /connection refused|ECONNREFUSED|endpoint.*unreachable/i,
        message: 'Cannot connect to the SPARQL endpoint.',
        hint: 'Check that the endpoint URL is correct and the server is running.'
    },
    {
        pattern: /403|forbidden/i,
        message: 'Access to the SPARQL endpoint was denied.',
        hint: 'The endpoint may require authentication or restrict certain query types.'
    },
    {
        pattern: /404|not found/i,
        message: 'The SPARQL endpoint was not found.',
        hint: 'Verify the endpoint URL is correct. The server may be temporarily unavailable.'
    }
];

function onFailure(report) {
    hideQuerySpinner();

    // Extract raw error text
    var rawError = '';
    if (report.responseText) {
        var preMatch = report.responseText.match(/<pre>([\s\S]*)<\/pre>/);
        rawError = preMatch ? preMatch[1] : report.responseText;
    } else {
        rawError = 'No response received from the server.';
    }

    // Match against known error patterns
    var friendlyMessage = 'Something went wrong with your query.';
    var friendlyHint = 'Try checking your query syntax or verifying the endpoint is available.';

    // Phase 9 — RELIAB-02: status-code matching runs BEFORE body matching.
    // Each entry may carry statusCodes:[..], pattern:RegExp, or both.
    var statusNum = (typeof report.status === 'number') ? report.status : -1;
    for (var i = 0; i < SPARQL_ERROR_PATTERNS.length; i++) {
        var entry = SPARQL_ERROR_PATTERNS[i];
        var statusOk = entry.statusCodes ? entry.statusCodes.indexOf(statusNum) !== -1 : true;
        var bodyOk = entry.pattern ? entry.pattern.test(rawError) : true;
        if (!entry.statusCodes && !entry.pattern) continue;
        if (statusOk && bodyOk) {
            friendlyMessage = entry.message;
            friendlyHint = entry.hint;
            break;
        }
    }

    // Phase 9 — RELIAB-02 + RELIAB-05: disambiguate xhr.status === 0.
    // The flag _timeoutFired is set by sparql.js xhr.ontimeout (Plan 02).
    if (statusNum === 0) {
        if (report._timeoutFired) {
            var timeoutMs = (window.SNORQL_CONFIG && window.SNORQL_CONFIG.queryTimeoutMs) || 60000;
            var timeoutSec = Math.round(timeoutMs / 1000);
            friendlyMessage = 'Network timeout — query exceeded ' + timeoutSec + 's.';
            friendlyHint = 'The endpoint may be busy or the query is too complex. Try adding LIMIT or simplifying the query.';
        } else {
            friendlyMessage = 'Request did not complete.';
            friendlyHint = 'Check the endpoint health indicator (top-right) for CORS or connectivity status.';
        }
    }

    // Build the result display
    var container = document.createElement('div');

    var alert = document.createElement('div');
    alert.className = 'alert alert-warning';
    alert.appendChild(document.createTextNode(friendlyMessage));
    container.appendChild(alert);

    var hint = document.createElement('p');
    hint.className = 'error-hint';
    hint.appendChild(document.createTextNode(friendlyHint));
    container.appendChild(hint);

    var toggle = document.createElement('a');
    toggle.className = 'error-details-toggle';
    toggle.href = '#';
    toggle.appendChild(document.createTextNode('Show technical details'));
    container.appendChild(toggle);

    var rawPre = document.createElement('pre');
    rawPre.className = 'error-raw';
    rawPre.textContent = rawError;
    container.appendChild(rawPre);

    jQuery(toggle).on('click', function(e) {
        e.preventDefault();
        var $raw = jQuery(rawPre);
        $raw.toggle();
        jQuery(this).text($raw.is(':visible') ? 'Hide technical details' : 'Show technical details');
    });

    setResult(container);
}

function setResult(node) {
    display(node, 'result');
}

function display(node, whereID) {
    var where = document.getElementById(whereID);
    if (!where) {
        alert('ID not found: ' + whereID);
        return;
    }
    while (where.firstChild) {
        where.removeChild(where.firstChild);
    }
    if (node == null) return;
    where.appendChild(node);
}

function displayResult(json, resultTitle) {
    hideQuerySpinner();

    var div = document.createElement('div');

    var resCount = document.createElement("small");
    resCount.classList.add("text-muted");
    resCount.appendChild(document.createTextNode(" ("+json.results.bindings.length+" results in "+json.executionTime+" seconds)"));

    var title = document.createElement('h3');
    title.appendChild(document.createTextNode(resultTitle));
    title.appendChild(resCount);
    div.appendChild(title);

    if (json.results.bindings.length == 0) {
        var p = document.createElement('p');
        p.className = 'empty';
        p.appendChild(document.createTextNode('[no results]'));
        div.appendChild(p);
    } else {
        var table = jsonToHTML(json);
        attachResultSorting(table);
        div.appendChild(buildResultToolbar(table, json.results.bindings.length));
        div.appendChild(table);
    }
    setResult(div);
}

// ─── Client-side filtering and sorting of the results table ───
// Both act on the rendered table only. Downloads re-run the query and always contain every row.

// Text of one row, cells joined by a tab so a filter word cannot match across a cell boundary.
// Cached on the row: results can run to tens of thousands of rows and the filter runs per keystroke.
function resultRowText(row) {
    if (row._snorqlFilterText === undefined) {
        var parts = [];
        for (var i = 0; i < row.cells.length; i++) {
            parts.push((row.cells[i].textContent || '').trim());
        }
        row._snorqlFilterText = parts.join('\t').toLowerCase();
    }
    return row._snorqlFilterText;
}

// Shows the rows that contain every whitespace-separated word of the term; returns how many are shown.
function filterResultRows(table, term) {
    var words = (term || '').toLowerCase().split(/\s+/).filter(function(w) { return w !== ''; });
    var tbody = table.tBodies[0];
    var visible = 0;
    if (!tbody) return 0;
    for (var i = 0; i < tbody.rows.length; i++) {
        var row = tbody.rows[i];
        var text = resultRowText(row);
        var match = true;
        for (var w = 0; w < words.length; w++) {
            if (text.indexOf(words[w]) === -1) { match = false; break; }
        }
        row.style.display = match ? '' : 'none';
        if (match) visible++;
    }
    return visible;
}

// Numbers sort numerically; everything else sorts naturally, so aop:3 comes before aop:12.
function compareCellValues(a, b) {
    var na = Number(a), nb = Number(b);
    if (a !== '' && b !== '' && isFinite(na) && isFinite(nb)) return na - nb;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

function sortResultTable(table, colIndex, descending) {
    var tbody = table.tBodies[0];
    if (!tbody) return;
    var rows = Array.prototype.slice.call(tbody.rows);
    rows.sort(function(r1, r2) {
        var c1 = r1.cells[colIndex] ? (r1.cells[colIndex].textContent || '').trim() : '';
        var c2 = r2.cells[colIndex] ? (r2.cells[colIndex].textContent || '').trim() : '';
        var c = compareCellValues(c1, c2);
        return descending ? -c : c;
    });
    for (var i = 0; i < rows.length; i++) {
        tbody.appendChild(rows[i]);
    }
}

// Click (or Enter/Space) on a header sorts ascending, then toggles; aria-sort marks the active column.
function attachResultSorting(table) {
    if (!table.tHead || !table.tHead.rows.length) return;
    var headers = table.tHead.rows[0].cells;
    function sortBy(th, col) {
        var descending = th.getAttribute('aria-sort') === 'ascending';
        for (var j = 0; j < headers.length; j++) {
            headers[j].removeAttribute('aria-sort');
        }
        th.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
        sortResultTable(table, col, descending);
    }
    for (var i = 0; i < headers.length; i++) {
        (function(th, col) {
            th.className = (th.className ? th.className + ' ' : '') + 'sortable';
            th.tabIndex = 0;
            th.title = 'Sort by ' + (th.textContent || '');
            th.addEventListener('click', function() { sortBy(th, col); });
            th.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    sortBy(th, col);
                }
            });
        })(headers[i], i);
    }
}

function buildResultToolbar(table, total) {
    var bar = document.createElement('div');
    bar.className = 'results-toolbar form-inline';

    var input = document.createElement('input');
    input.type = 'search';
    input.className = 'form-control input-sm results-filter';
    input.placeholder = 'Filter results...';
    input.setAttribute('aria-label', 'Filter results');
    input.title = 'Shows rows containing every word you type. Filters this table only; downloads include all results.';

    var count = document.createElement('small');
    count.className = 'text-muted results-count';
    count.setAttribute('aria-live', 'polite');

    function update() {
        var visible = filterResultRows(table, input.value);
        count.textContent = input.value.trim() ? 'Showing ' + visible + ' of ' + total + ' rows' : '';
    }

    var timer = null;
    input.addEventListener('input', function() {
        clearTimeout(timer);
        timer = setTimeout(update, 150);
    });

    bar.appendChild(input);
    bar.appendChild(document.createTextNode(' '));
    bar.appendChild(count);
    bar._update = update;
    return bar;
}

function jsonToHTML(json) {

    var table = document.createElement('table');
    table.id = 'queryresults';
    table.className = 'table table-striped table-bordered';

    var thead = document.createElement('thead');
    var tr = document.createElement('tr');

    for (var i in json.head.vars) {
        var th = document.createElement('th');
        th.appendChild(document.createTextNode(json.head.vars[i]));
        tr.appendChild(th);
    }
    thead.appendChild(tr);

    var tbody = document.createElement('tbody');

    for (var i in json.results.bindings) {
        var binding = json.results.bindings[i];
        var tr = document.createElement('tr');

        for (var v in json.head.vars) {
            td = document.createElement('td');
            var varName = json.head.vars[v];
            var node = binding[varName];

            if(node != null){
                node.head = varName;
            }

            td.appendChild(nodeToHTML(node, function(uri) { return escape(uri); }));

            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
    table.appendChild(thead);
    table.appendChild(tbody);

    return table;
}

function toQName(uri) {
    for (nsURI in CONFIG.namespaces) {
        if (uri.indexOf(nsURI) == 0) {
            return CONFIG.namespaces[nsURI] + ':' + uri.substring(nsURI.length);
        }
    }
    return null;
}

function toQNameOrURI(uri) {
    for (nsURI in CONFIG.namespaces) {
        if (uri.indexOf(nsURI) == 0) {
            return CONFIG.namespaces[nsURI] + ':' + uri.substring(nsURI.length);
        }
    }
    return '<' + uri + '>';
}

var xsdNamespace = 'http://www.w3.org/2001/XMLSchema#';
var numericXSDTypes = ['long', 'decimal', 'float', 'double', 'int', 'short', 'byte', 'integer',
        'nonPositiveInteger', 'negativeInteger', 'nonNegativeInteger', 'positiveInteger',
        'unsignedLong', 'unsignedInt', 'unsignedShort', 'unsignedByte'];
for (i in numericXSDTypes) {
    numericXSDTypes[i] =  xsdNamespace + numericXSDTypes[i];
}

function nodeToHTML(node, linkMaker) {
    if (!node) {
        var span = document.createElement('span');
        span.className = 'unbound';
        span.title = 'Unbound'
        span.appendChild(document.createTextNode('-'));
        return span;
    }
    if (node.type == 'uri') {

        if(CONFIG.renderers.enableSVGRenderer && node.value.endsWith(".svg")){

            text = `
            <a target="_blank" href="`+node.value+`">
                <svg width="200" height="150">
                    <image xlink:href="`+node.value+`" src="assets/images/noimage.png" width="200" height="150"/>
                </svg>
            </a>
            `;
            var template = document.createElement('template');
            template.innerHTML = text.trim();
            return template.content.firstChild;

        }else{

            var span = document.createElement('span');
            span.className = 'uri';
            var qname = toQName(node.value);
            var a = document.createElement('a');
            a.href = node.value;
            a.target = "_blank";

            if (qname) {
                a.appendChild(document.createTextNode(qname));
                span.appendChild(a);
            } else {
                a.appendChild(document.createTextNode(node.value));
                span.appendChild(a);
            }

            return span;
        }
    }
    if (node.type == 'bnode') {
        return document.createTextNode('_:' + node.value);
    }

    if(CONFIG.showLiteralType){

        if (node.type == 'literal') {
            var text = '"' + node.value + '"';
            if (node['xml:lang']) {
                text += '@' + node['xml:lang'];
            }
            return document.createTextNode(text);
        }
        
        if (node.type == 'typed-literal') {

            var text = '"' + node.value + '"';

            if (node.datatype) {
                text += '^^' + toQNameOrURI(node.datatype);
            }

            for (i in numericXSDTypes) {
                if (numericXSDTypes[i] == node.datatype) {
                    var span = document.createElement('span');
                    span.title = text;
                    span.appendChild(document.createTextNode(node.value));
                    return span;
                }
            }
            return document.createTextNode(text);
        }

    }else{
        
        if(CONFIG.renderers.enableSMILESRenderer && node.head == "smilesDepict"){

            var depictUrl = "https://www.simolecule.com/cdkdepict/depict/bow/svg?smi="+encodeURIComponent(node.value)+"&zoom=2.0&annotate=none&bgcolor=transparent";

            text = `
                <a target="_blank" href="`+depictUrl+`">
                    <img src="`+depictUrl+`" width="200" height="150" onerror="this.onerror=null;this.src='assets/images/noimage.png';" alt="SMILES depiction" />
                </a>
            `;
            var template = document.createElement('template');
            template.innerHTML = text.trim();
            return template.content.firstChild;


        }else{
            return document.createTextNode(node.value);
        }
    }

    return document.createTextNode('???');
}

function exportResults(url, sparql, type, output) {

    service = new SPARQL.Service(url);
    var _phase9Prefixed = prepareQueryForSend(sparql);   // RELIAB-03: compute once for chooseMethod + service.query (declare-once-reuse-twice)
    service.setMethod(chooseMethod(url, _phase9Prefixed));
    if (CONFIG.defaultGraph != "") {
        service.addDefaultGraph(CONFIG.defaultGraph);
    }

    if(type === "csv"){
        service.setRequestHeader('Accept', 'application/sparql-results+json,*/*');
        service.setOutput('json');
    }else if(type === "tsv"){
        service.setRequestHeader('Accept', 'text/tab-separated-values,*/*');
        service.setOutput('tsv');
    }else{
        service.setRequestHeader('Accept', 'application/sparql-results+'+type+',*/*');
        service.setOutput(type);
    }

    service.query(_phase9Prefixed, {
            success: function(json) { renderOutput(json, type); },
            failure: onExportFailure
    });
}

function renderOutput(results, type){

    if(type === 'csv'){
        exportCSV(results);
    }else if(type === 'json'){

        var download_link = document.createElement('a');
        download_link.setAttribute('href', 'data:text/csv;charset=utf8,' + encodeURIComponent(JSON.stringify(results)));
        download_link.setAttribute('download', "snorql-json-"+(new Date().getTime() / 1000)+".json");
        download_link.click();

    }else if(type === 'tsv'){

        var download_link = document.createElement('a');
        download_link.setAttribute('href', 'data:text/tab-separated-values;charset=utf8,' + encodeURIComponent(results));
        download_link.setAttribute('download', "snorql-tsv-"+(new Date().getTime() / 1000)+".tsv");
        download_link.click();

    }else if(type === 'xml'){

        var download_link = document.createElement('a');
        download_link.setAttribute('href', 'data:text/xml;charset=utf8,' + encodeURIComponent(results));
        download_link.setAttribute('download', "snorql-xml-"+(new Date().getTime() / 1000)+".xml");
        download_link.click();
    }
}

function exportCSV(json){

    if (typeof json !== 'undefined') {

        var csv = "";

        for (var i in json.head.vars) {

            csv += formatData(json.head.vars[i]);

            if(i < json.head.vars.length-1){
                csv += ',';
            }
        }

        csv += "\n";

        for (var i in json.results.bindings) {

            var binding = json.results.bindings[i];

            for (var v in json.head.vars) {

                var varName = json.head.vars[v];
                var node = binding[varName];

                if (typeof node !== 'undefined') {
                    csv += formatData(node.value);
                }else{
                    csv += '' ;
                }

                if(v < json.head.vars.length-1){
                    csv += ',';
                }

            }
            csv += "\n";
        }

        var download_link = document.createElement('a');
        download_link.setAttribute('href', 'data:text/csv;charset=utf8,' + encodeURIComponent(csv));
        download_link.setAttribute('download', "snorql-csv-"+(new Date().getTime() / 1000)+".csv");
        download_link.click();

    }else{
        alert('Please execute a query fist then try to export');
    }
}

function formatData(input) {
    // RFC4180
    var regexp = new RegExp(/["]/g);
    var output = input.replace(regexp, '""');
    //HTML
    var regexp = new RegExp(/\<[^\<]+\>/g);
    var output = output.replace(regexp, "");
    output = output.replace(/&nbsp;/gi,' '); //replace &nbsp;
    if (output == "") return '';
    return '"' + output.trim() + '"';
}

function onExportFailure(){
    alert("Export failed");
}
