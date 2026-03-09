var CONFIG = window.SNORQL_CONFIG;
var _fullTreeData = null;
var _paramMode = false;
var _paramIgnoreChange = false;
var _currentTemplate = null;
var _currentParams = null;
var _pathwayCache = null;
var _pathwayCachePromise = null;
var _speciesCache = null;
var _speciesCachePromise = null;

function setCookie(cname, cvalue){
    var d = new Date();
    d.setTime(d.getTime() + (365*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue+ ";" + expires + ";path=/";
}

function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(';');
    for(var i = 0; i < ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) == ' ') {
            c = c.substring(1);
        }
        if (c.indexOf(name) == 0) {
            return c.substring(name.length, c.length);
        }
    }
    return "";
}

function clearLegacyCookies() {
    document.cookie = "endpoint=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "examplesrepo=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
}

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
    checkEndpointHealth();
}

function changeExamplesRepo() {
    // Removed: no longer persists to cookie
    // Changes are temporary (session only)
}

function getPrefixes(){

    prefixes = '';
    for (prefix in CONFIG.namespaces) {
        var uri = CONFIG.namespaces[prefix];
        prefixes = prefixes + 'PREFIX ' + prefix + ': <' + uri + '>\n';
    }
    return prefixes;
}

function parseRqHeaders(content) {
    var result = { title: null, description: null, categories: [], params: [] };

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

        var catMatch = line.match(/^#\s*category:\s*(.+)/i);
        if (catMatch) {
            var cats = catMatch[1].split(',').map(function(c) { return c.trim(); });
            result.categories = result.categories.concat(cats);
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

                if (paramType.indexOf('enum:') === 0) {
                    paramOptions = paramType.substring(5).split(',').map(function(o) { return o.trim(); });
                    paramType = 'enum';
                }

                result.params.push({
                    name: paramName,
                    type: paramType,
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

function sanitizeEnumValue(value, allowedOptions) {
    if (allowedOptions && allowedOptions.indexOf(value) !== -1) {
        return value;
    }
    return null;
}

function substituteParams(templateContent, params) {
    var view = {};
    for (var i = 0; i < params.length; i++) {
        var param = params[i];
        var el = document.getElementById('param-' + param.name);
        var value = (el && el.value !== '') ? el.value : param.defaultValue;

        if (param.type === 'string') {
            view[param.name] = sanitizeSparqlString(value);
        } else if (param.type === 'uri') {
            var sanitized = sanitizeSparqlUri(value);
            view[param.name] = sanitized || sanitizeSparqlUri(param.defaultValue) || param.defaultValue;
        } else if (param.type === 'enum') {
            var enumVal = sanitizeEnumValue(value, param.options);
            view[param.name] = enumVal !== null ? enumVal : param.defaultValue;
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

function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function fetchPathwayList() {
    if (_pathwayCache) {
        return $.Deferred().resolve(_pathwayCache).promise();
    }
    if (_pathwayCachePromise) {
        return _pathwayCachePromise;
    }

    var endpoint = document.getElementById('endpoint').value.trim();
    var sparql = 'PREFIX dcterms: <http://purl.org/dc/terms/>\n' +
        'PREFIX dc: <http://purl.org/dc/elements/1.1/>\n' +
        'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
        'SELECT DISTINCT (str(?wpId) as ?id) (str(?title) as ?name) (str(?orgName) as ?species)\n' +
        'WHERE { ?pw a wp:Pathway ; dcterms:identifier ?wpId ; dc:title ?title ; wp:organismName ?orgName . }\n' +
        'ORDER BY ?wpId';

    var url = endpoint + '?query=' + encodeURIComponent(sparql) + '&output=json';

    var deferred = $.Deferred();
    $.ajax({
        url: url,
        dataType: 'json'
    }).done(function(json) {
        var list = [];
        if (json && json.results && json.results.bindings) {
            for (var i = 0; i < json.results.bindings.length; i++) {
                var b = json.results.bindings[i];
                list.push({
                    id: b.id ? b.id.value : '',
                    title: b.name ? b.name.value : '',
                    species: b.species ? b.species.value : ''
                });
            }
        }
        _pathwayCache = list;
        _pathwayCachePromise = null;
        deferred.resolve(list);
    }).fail(function() {
        _pathwayCachePromise = null;
        deferred.resolve([]);
    });

    _pathwayCachePromise = deferred.promise();
    return _pathwayCachePromise;
}

function fetchSpeciesList() {
    if (_speciesCache) {
        return $.Deferred().resolve(_speciesCache).promise();
    }
    if (_speciesCachePromise) {
        return _speciesCachePromise;
    }

    var endpoint = document.getElementById('endpoint').value.trim();
    var sparql = 'PREFIX wp: <http://vocabularies.wikipathways.org/wp#>\n' +
        'SELECT DISTINCT ?species WHERE {\n' +
        '  ?pw a wp:Pathway ; wp:organismName ?species .\n' +
        '} ORDER BY ?species';

    var url = endpoint + '?query=' + encodeURIComponent(sparql) + '&output=json';

    var deferred = $.Deferred();
    $.ajax({
        url: url,
        dataType: 'json'
    }).done(function(json) {
        var list = [];
        if (json && json.results && json.results.bindings) {
            for (var i = 0; i < json.results.bindings.length; i++) {
                var b = json.results.bindings[i];
                if (b.species && b.species.value) {
                    list.push(b.species.value);
                }
            }
        }
        _speciesCache = list;
        _speciesCachePromise = null;
        deferred.resolve(list);
    }).fail(function() {
        _speciesCachePromise = null;
        deferred.resolve([]);
    });

    _speciesCachePromise = deferred.promise();
    return _speciesCachePromise;
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

    function selectItem(value) {
        $input.val(value);
        $dropdown.hide();
        highlightIndex = -1;
        $input.trigger('change');
    }

    $input.on('focus', function() {
        this.select();
    });

    $input.on('input', function() {
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
                selectItem($opts.eq(highlightIndex).attr('data-value'));
            }
        } else if (e.keyCode === 27) { // Escape
            $dropdown.hide();
            highlightIndex = -1;
        }
    });

    $dropdown.on('click', '.autocomplete-option', function() {
        selectItem($(this).attr('data-value'));
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

function initPathwayAutocomplete() {
    initAutocomplete('param-pathwayId', function(val, render) {
        fetchPathwayList().done(function(list) {
            var filtered = [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].id.toLowerCase().indexOf(val) !== -1 ||
                    list[i].title.toLowerCase().indexOf(val) !== -1) {
                    filtered.push(list[i]);
                }
            }
            render(filtered);
        });
    }, function(item) {
        var speciesLabel = item.species ? ' <span class="autocomplete-option-species">[' + escapeHtml(item.species) + ']</span>' : '';
        return '<div class="autocomplete-option" data-value="' + escapeHtml(item.id) + '">' +
            '<span class="autocomplete-option-id">' + escapeHtml(item.id) + '</span> ' +
            '<span class="autocomplete-option-title">' + escapeHtml(item.title) + '</span>' +
            speciesLabel +
            '</div>';
    });
    fetchPathwayList();
}

function initSpeciesAutocomplete() {
    initAutocomplete('param-species', function(val, render) {
        fetchSpeciesList().done(function(list) {
            var filtered = [];
            for (var i = 0; i < list.length; i++) {
                if (list[i].toLowerCase().indexOf(val) !== -1) {
                    filtered.push(list[i]);
                }
            }
            render(filtered);
        });
    }, function(item) {
        return '<div class="autocomplete-option" data-value="' + escapeHtml(item) + '">' +
            escapeHtml(item) +
            '</div>';
    });
    fetchSpeciesList();
}

function buildParamPanel(params, templateContent) {
    var $panel = $('#param-panel');
    var html = '<div class="param-row">';

    for (var i = 0; i < params.length; i++) {
        var p = params[i];
        html += '<div class="param-item">';
        html += '<label for="param-' + p.name + '">' + p.label + '</label> ';

        if (p.type === 'enum' && p.options) {
            html += '<select class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '">';
            for (var j = 0; j < p.options.length; j++) {
                var selected = (p.options[j] === p.defaultValue) ? ' selected' : '';
                html += '<option value="' + p.options[j] + '"' + selected + '>' + p.options[j] + '</option>';
            }
            html += '</select>';
        } else if (p.name === 'pathwayId') {
            html += '<div class="autocomplete-wrapper">';
            html += '<input type="text" class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '" value="' + escapeHtml(p.defaultValue) + '" placeholder="Type pathway ID or name..." autocomplete="off">';
            html += '<div class="autocomplete-dropdown"></div>';
            html += '</div>';
        } else if (p.name === 'species') {
            html += '<div class="autocomplete-wrapper">';
            html += '<input type="text" class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '" value="' + escapeHtml(p.defaultValue) + '" placeholder="Type species name..." autocomplete="off">';
            html += '<div class="autocomplete-dropdown"></div>';
            html += '</div>';
        } else {
            html += '<input type="text" class="form-control param-input" id="param-' + p.name + '" data-param="' + p.name + '" value="' + p.defaultValue + '" placeholder="' + p.label + '">';
        }

        html += '</div>';
    }

    html += '</div>';
    $panel.html(html).show();

    if ($('#param-pathwayId').length) {
        initPathwayAutocomplete();
    }
    if ($('#param-species').length) {
        initSpeciesAutocomplete();
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
                        : "https://raw.githubusercontent.com/" + repo + "/master/" + path;
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
                        : "https://raw.githubusercontent.com/" + repo + "/master/" + path;
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
                        : "https://raw.githubusercontent.com/" + repo + "/master/" + path;
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
            node.categories = meta.categories || [];
            node.queryContent = content;
            return node;
        }, function() {
            // If individual file fetch fails, use cleaned filename
            node.text = cleanFilename(node.originalFilename || node.text);
            node.description = '';
            node.categories = [];
            node.queryContent = null;
            return node;
        });
    });

    return $.when.apply($, promises).then(function() {
        return tree;
    });
}

function collectCategories(nodes, categorySet) {
    if (!nodes) return;
    nodes.forEach(function(node) {
        if (node.categories && node.categories.length > 0) {
            node.categories.forEach(function(c) { categorySet.add(c); });
        }
        if (node.nodes) {
            collectCategories(node.nodes, categorySet);
        }
    });
}

function buildCategoryFilter(treeData, suffix) {
    var categories = new Set();
    collectCategories(treeData, categories);

    if (categories.size === 0) return;

    var $container = $('#category-filter' + suffix);
    $container.empty();

    var html = '<button class="btn btn-default btn-xs active" data-category="all">All</button>';
    categories.forEach(function(cat) {
        html += '<button class="btn btn-default btn-xs" data-category="' + cat + '">' + cat + '</button>';
    });
    $container.html(html);

    $container.on('click', 'button', function() {
        $container.find('button').removeClass('active');
        $(this).addClass('active');

        var selectedCategory = $(this).data('category');
        if (selectedCategory === 'all') {
            initTreeview(JSON.parse(JSON.stringify(_fullTreeData)), suffix);
        } else {
            var filtered = filterTreeByCategory(_fullTreeData, selectedCategory);
            initTreeview(filtered, suffix);
        }
    });
}

function filterTreeByCategory(nodes, category) {
    var result = [];
    nodes.forEach(function(node) {
        if (node.nodes) {
            var filteredChildren = filterTreeByCategory(node.nodes, category);
            if (filteredChildren.length > 0) {
                var folderCopy = JSON.parse(JSON.stringify(node));
                folderCopy.nodes = filteredChildren;
                result.push(folderCopy);
            }
        } else {
            if (node.categories && node.categories.indexOf(category) !== -1) {
                result.push(JSON.parse(JSON.stringify(node)));
            }
        }
    });
    return result;
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
            if (!matches && node.categories) {
                for (var i = 0; i < node.categories.length; i++) {
                    if (node.categories[i].toLowerCase().indexOf(lowerPattern) !== -1) {
                        matches = true;
                        break;
                    }
                }
            }
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

    // Reset category filter to "All" since search operates on full data
    $('#category-filter' + suffix + ' button').removeClass('active');
    $('#category-filter' + suffix + ' button[data-category="all"]').addClass('active');
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

                    // Show title and description
                    var $info = $('#query-info');
                    if (parsed.title || parsed.description) {
                        var infoHtml = '';
                        if (parsed.title) infoHtml += '<strong>' + parsed.title + '</strong>';
                        if (parsed.description) infoHtml += '<span class="text-muted"> &mdash; ' + parsed.description + '</span>';
                        $info.html(infoHtml).show();
                    } else {
                        $info.hide();
                    }

                    if (parsed.params.length > 0) {
                        _currentTemplate = content;
                        _currentParams = parsed.params;
                        _paramMode = true;
                        buildParamPanel(parsed.params, content);
                        var substituted = substituteParams(content, parsed.params);
                        var body = stripHeaders(substituted);
                        updateUrl(body);
                    } else {
                        _paramMode = false;
                        _currentTemplate = null;
                        _currentParams = null;
                        $('#param-panel').slideUp();
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
        buildCategoryFilter(_fullTreeData, suffix);
        return;
    }

    var repoPath = repo.substring(19);
    var link = repo.includes("http://localhost")
        ? repo + "/git/trees/master?recursive=1"
        : "https://api.github.com/repos/" + repoPath + "/git/trees/master?recursive=1";

    mainAjax(link, repo.includes("http://localhost") ? repo : repoPath).then(function(tree) {
        return enrichTreeWithMetadata(tree);
    }).then(function(enrichedTree) {
        setCachedExamples(repo, enrichedTree);
        _fullTreeData = JSON.parse(JSON.stringify(enrichedTree));
        initTreeview(enrichedTree, suffix);
        buildCategoryFilter(_fullTreeData, suffix);
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
    // Clear legacy cookies from previous versions
    clearLegacyCookies();

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
    $('#param-panel').on('input change', '.param-input', function() {
        if (_currentTemplate && _currentParams) {
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

    // Manual edit detection: hide param panel when user edits the query directly
    editor.on('change', function(cm, changeObj) {
        if (_paramIgnoreChange) return;
        if (_paramMode && changeObj.origin !== 'setValue') {
            _paramMode = false;
            _currentTemplate = null;
            _currentParams = null;
            $('#param-panel').slideUp();
        }
    });

    // Initialize endpoint health indicator
    $('#endpoint-health-dot').tooltip({ placement: 'bottom', trigger: 'hover' });
    checkEndpointHealth();
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
    service.setMethod('GET');
    if (CONFIG.defaultGraph != "") {
        service.addDefaultGraph(CONFIG.defaultGraph);
    }

    service.setRequestHeader('Accept', 'application/sparql-results+json,*/*');
    service.setOutput('json');

    showQuerySpinner();
    service.query(sparql, {
            success: callback,
            failure: onFailure
    });
}

var SPARQL_ERROR_PATTERNS = [
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

    for (var i = 0; i < SPARQL_ERROR_PATTERNS.length; i++) {
        if (SPARQL_ERROR_PATTERNS[i].pattern.test(rawError)) {
            friendlyMessage = SPARQL_ERROR_PATTERNS[i].message;
            friendlyHint = SPARQL_ERROR_PATTERNS[i].hint;
            break;
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
        div.appendChild(jsonToHTML(json));
    }
    setResult(div);
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
    service.setMethod('GET');
    if (CONFIG.defaultGraph != "") {
        service.addDefaultGraph(CONFIG.defaultGraph);
    }

    if(type === "csv"){
        service.setRequestHeader('Accept', 'application/sparql-results+json,*/*');
        service.setOutput('json');
    }else{
        service.setRequestHeader('Accept', 'application/sparql-results+'+type+',*/*');
        service.setOutput(type);
    }

    service.query(sparql, {
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

    }else if(type === 'xml'){

        var download_link = document.createElement('a');
        download_link.setAttribute('href', 'data:text/csv;charset=utf8,' + encodeURIComponent(results));
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
