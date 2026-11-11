/*
 * Examples from a published index (CONFIG.examplesFormat = "index").
 *
 * An examples repository of .ttl files (see tools/examples/README.md) publishes,
 * on its examples-index branch:
 *   index.json                    every example with its metadata and query
 *   history.json                  every published version of every example
 *   versions/<id>/<version>.json  one example as it was at that version
 *
 * Every example has a permanent identifier (e.g. WPQ036). The tree is built
 * from the categories in the index, and links use the identifier, so files in
 * the repository can move without breaking anything. Parameters are bound in
 * the query by a VALUES block holding the default; the editor replaces the
 * value in that block, so the query is valid SPARQL either way.
 *
 * Everything here is pure (no DOM, no network) so it can be unit tested;
 * snorql.js does the loading and the page updates.
 */
(function (root) {
    'use strict';

    var INDEX_SCHEMA = 1;
    var INDEX_BRANCH = 'examples-index';
    var ID_PATTERN = /^[A-Za-z]+[0-9]{3,}$/;
    var VERSION_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;

    function escapeHtml(str) {
        return String(str === null || str === undefined ? '' : str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // Only http(s) links end up in href attributes.
    function safeUrl(url) {
        return typeof url === 'string' && /^https?:\/\/[^\s"'<>]+$/i.test(url) ? url : null;
    }

    // Base URL (ending in /) of the published index. configured: CONFIG.examplesIndexUrl,
    // used as it is when set; otherwise the examples-index branch of the examples repository.
    function indexBase(repoPath, configured) {
        if (typeof configured === 'string' && configured.trim()) {
            var url = configured.trim();
            return /\/$/.test(url) ? url : url + '/';
        }
        if (typeof repoPath !== 'string' || !/^[^/\s]+\/[^/\s]+$/.test(repoPath)) return null;
        return 'https://raw.githubusercontent.com/' + repoPath + '/' + INDEX_BRANCH + '/';
    }

    function isIndex(data) {
        return !!data && data.schema === INDEX_SCHEMA && Array.isArray(data.examples);
    }

    function isId(key) {
        return typeof key === 'string' && ID_PATTERN.test(key);
    }

    function isVersion(v) {
        return typeof v === 'string' && VERSION_PATTERN.test(v);
    }

    function searchText(entry) {
        var parts = [entry.id, entry.label, entry.description].concat(entry.keywords || []);
        (entry.creators || []).concat(entry.contributors || []).forEach(function (p) { parts.push(p && p.name); });
        return parts.filter(Boolean).join(' \u0001 ').toLowerCase();
    }

    function leaf(entry) {
        return {
            text: entry.label,
            exampleId: entry.id,
            description: entry.description || '',
            searchText: searchText(entry),
            tags: [entry.id],
            icon: 'glyphicon glyphicon-file'
        };
    }

    // bootstrap-treeview nodes: the categories (in index order, children under their
    // parent) with their examples sorted by title. Deprecated examples and empty
    // categories are left out; examples without a known category go under "Other".
    function buildTree(index) {
        if (!isIndex(index)) return [];
        var nodes = {};
        var top = [];
        (index.categories || []).forEach(function (c) {
            nodes[c.iri] = { text: c.label, nodes: [], href: '#', categoryIri: c.iri, selectable: false };
        });
        (index.categories || []).forEach(function (c) {
            var parent = c.parent && nodes[c.parent];
            (parent ? parent.nodes : top).push(nodes[c.iri]);
        });
        var other = { text: 'Other', nodes: [], href: '#', selectable: false };
        var examples = index.examples.slice().sort(function (a, b) {
            return String(a.label).localeCompare(String(b.label));
        });
        examples.forEach(function (e) {
            if (e.deprecated) return;
            var placed = false;
            (e.categories || []).forEach(function (iri) {
                if (nodes[iri]) {
                    nodes[iri].nodes.push(leaf(e));
                    placed = true;
                }
            });
            if (!placed) other.nodes.push(leaf(e));
        });
        // Examples first, then subcategories, as a folder listing would show them.
        var prune = function (list) {
            return list.filter(function (n) {
                if (!n.nodes) return true;
                n.nodes = prune(n.nodes);
                n.nodes.sort(function (a, b) {
                    return (a.nodes ? 1 : 0) - (b.nodes ? 1 : 0);
                });
                return n.nodes.length > 0;
            });
        };
        if (other.nodes.length) top.push(other);
        return prune(top);
    }

    // The example a link asks for: by identifier (any letter case), or by a path the
    // example has or used to have (snorql:alias, or an old file name in git).
    function findExample(index, key) {
        if (!isIndex(index) || typeof key !== 'string' || !key) return null;
        var upper = key.toUpperCase();
        var i, e;
        for (i = 0; i < index.examples.length; i++) {
            e = index.examples[i];
            if (String(e.id).toUpperCase() === upper) return e;
        }
        for (i = 0; i < index.examples.length; i++) {
            e = index.examples[i];
            if (e.path === key || (e.aliases || []).indexOf(key) !== -1) return e;
        }
        return null;
    }

    // Parameters in the shape the parameter panel uses (see buildParamPanel in snorql.js).
    function toParams(entry) {
        return (entry.params || []).filter(function (p) {
            return /^[A-Za-z_][A-Za-z0-9_]*$/.test(p.name) &&
                /^[A-Za-z_][A-Za-z0-9_]*$/.test(p.variable || p.name);
        }).map(function (p) {
            var type = p.options && p.options.length ? 'enum'
                : p.autocomplete ? 'autocomplete'
                : (p.kind === 'iri' && !p.valueTemplate) ? 'uri' : 'string';
            return {
                name: p.name,
                variable: p.variable || p.name,
                type: type,
                kind: p.kind === 'iri' ? 'iri' : 'literal',
                valueTemplate: p.valueTemplate || null,
                autocompleteType: p.autocomplete || null,
                defaultValue: String(p['default']),
                label: p.label || p.name,
                description: p.description || '',
                options: p.options && p.options.length ? p.options.map(function (o) {
                    return { value: String(o.value), label: String(o.label || o.value) };
                }) : null
            };
        });
    }

    function sparqlString(value) {
        return '"' + String(value)
            .replace(/\\/g, '\\\\')
            .replace(/"/g, '\\"')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            .replace(/\t/g, '\\t') + '"';
    }

    // The SPARQL term for a parameter value, or null when the value is not acceptable
    // (an enum value that is not an option, an IRI with characters IRIs cannot hold).
    function sparqlTerm(param, value) {
        value = String(value === null || value === undefined ? '' : value);
        if (param.options) {
            var ok = param.options.some(function (o) { return o.value === value; });
            if (!ok) return null;
        }
        if (param.kind !== 'iri') return sparqlString(value);
        var iri = param.valueTemplate
            ? param.valueTemplate.replace('{value}', encodeURIComponent(value))
            : value.replace(/^</, '').replace(/>$/, '');
        if (!iri || /[<>"{}|^`\\\s]/.test(iri)) return null;
        return '<' + iri + '>';
    }

    // The query with each parameter's VALUES block holding the value from readValue(param)
    // (or the default, when that value is not acceptable).
    function substituteValues(query, params, readValue) {
        var out = String(query);
        (params || []).forEach(function (p) {
            var term = sparqlTerm(p, readValue ? readValue(p) : p.defaultValue) || sparqlTerm(p, p.defaultValue);
            if (!term) return;
            var re = new RegExp('(\\bVALUES\\s+[?$]' + p.variable + '\\s*\\{)[^}]*(\\})', 'i');
            out = out.replace(re, function (m, open, close) { return open + ' ' + term + ' ' + close; });
        });
        return out;
    }

    // Version of example id that a ref names: a commit (7 to 40 hex characters) at
    // which the example got a version, or a release tag. null when the history has none.
    function resolveRef(history, id, ref) {
        if (!history || typeof ref !== 'string' || !ref) return null;
        var releases = history.releases || {};
        if (Object.prototype.hasOwnProperty.call(releases, ref)) {
            var v = releases[ref].versions && releases[ref].versions[id];
            return isVersion(v) ? v : null;
        }
        if (/^[0-9a-fA-F]{7,40}$/.test(ref)) {
            var prefix = ref.toLowerCase();
            var matches = versionsOf(history, id).filter(function (h) {
                return typeof h.commit === 'string' && h.commit.indexOf(prefix) === 0;
            });
            if (matches.length === 1) return matches[0].version;
        }
        return null;
    }

    // [{ version, commit, date, path }] oldest first.
    function versionsOf(history, id) {
        var list = history && history.examples && history.examples[id];
        return Array.isArray(list) ? list.filter(function (h) { return h && isVersion(h.version); }) : [];
    }

    function versionUrl(base, id, version) {
        if (!isId(id) || !isVersion(version)) return null;
        return base + 'versions/' + encodeURIComponent(id) + '/' + encodeURIComponent(version) + '.json';
    }

    function person(p) {
        var name = escapeHtml(p && p.name ? p.name : (p && p.iri) || '');
        var url = safeUrl(p && p.iri);
        if (!url) return name;
        var orcid = /^https:\/\/orcid\.org\//.test(url);
        return '<a href="' + escapeHtml(url) + '" target="_blank" rel="noopener"' +
            (orcid ? ' title="ORCID ' + escapeHtml(url.replace('https://orcid.org/', '')) + '"' : '') + '>' + name + '</a>';
    }

    var LICENSES = {
        'https://www.gnu.org/licenses/gpl-3.0.html': 'GPL-3.0',
        'https://creativecommons.org/publicdomain/zero/1.0/': 'CC0 1.0',
        'https://creativecommons.org/licenses/by/4.0/': 'CC BY 4.0'
    };

    // HTML for the metadata under the description. shown: { version, current } where
    // version is the version on screen and current the latest one.
    function metadataHtml(entry, shown) {
        shown = shown || {};
        var html = '';
        var version = shown.version || entry.version;
        if (entry.deprecated) {
            var replaced = '';
            if (entry.replacedBy) {
                var rid = String(entry.replacedBy).split('/').pop();
                replaced = isId(rid) ? ' Use <a href="?example=' + encodeURIComponent(rid) + '">' + escapeHtml(rid) + '</a> instead.' : '';
            }
            html += '<div class="alert alert-warning example-deprecated">This example is deprecated and no longer maintained.' + replaced + '</div>';
        }
        if (shown.current && version !== shown.current) {
            html += '<div class="alert alert-info example-old-version">You are looking at version ' + escapeHtml(version) +
                '; the current version is ' + escapeHtml(shown.current) + '.</div>';
        }
        html += '<div class="example-meta-line">';
        html += '<span class="label label-default example-id" title="Permanent identifier">' + escapeHtml(entry.id) + '</span> ';
        var date = entry.modified || entry.created;
        html += '<span class="example-version">version <select class="form-control input-sm" id="desc-version" title="Versions of this example">' +
            '<option value="' + escapeHtml(version) + '" selected>' + escapeHtml(version + (date ? ' \u2013 ' + date : '')) +
            '</option></select></span>';
        var lic = safeUrl(entry.license);
        if (lic) html += ' <a class="example-license" href="' + escapeHtml(lic) + '" target="_blank" rel="noopener">' + escapeHtml(LICENSES[lic] || 'licence') + '</a>';
        html += ' <button type="button" class="btn btn-default btn-xs" id="desc-copy-iri" title="' + escapeHtml(entry.iri) + '">' +
            '<i class="glyphicon glyphicon-link"></i> Copy IRI</button>';
        html += '</div>';
        var creators = (entry.creators || []).map(person);
        var contributors = (entry.contributors || []).map(person);
        if (creators.length) {
            html += '<div class="example-people">By ' + creators.join(', ') +
                (contributors.length ? '; with contributions from ' + contributors.join(', ') : '') + '</div>';
        }
        if ((entry.federatesWith || []).length) {
            html += '<div class="example-federated">Also queries ' + entry.federatesWith.map(function (f) {
                return '<code>' + escapeHtml(f) + '</code>';
            }).join(', ') + ', which can make it slower.</div>';
        }
        if ((entry.keywords || []).length) {
            html += '<div class="example-keywords">' + entry.keywords.map(function (k) {
                return '<span class="label label-info">' + escapeHtml(k) + '</span>';
            }).join(' ') + '</div>';
        }
        return html;
    }

    // <option>s for the version selector, newest first.
    function versionOptionsHtml(history, id, shownVersion) {
        var list = versionsOf(history, id).slice().reverse();
        if (!list.length) return '';
        return list.map(function (h, i) {
            var label = h.version + (i === 0 ? ' (current)' : '') + (h.date ? ' – ' + h.date : '');
            return '<option value="' + escapeHtml(h.version) + '"' + (h.version === shownVersion ? ' selected' : '') + '>' +
                escapeHtml(label) + '</option>';
        }).join('');
    }

    root.ExamplesIndex = {
        INDEX_SCHEMA: INDEX_SCHEMA,
        indexBase: indexBase,
        isIndex: isIndex,
        isId: isId,
        isVersion: isVersion,
        buildTree: buildTree,
        findExample: findExample,
        toParams: toParams,
        sparqlTerm: sparqlTerm,
        substituteValues: substituteValues,
        resolveRef: resolveRef,
        versionsOf: versionsOf,
        versionUrl: versionUrl,
        metadataHtml: metadataHtml,
        versionOptionsHtml: versionOptionsHtml,
        escapeHtml: escapeHtml,
        safeUrl: safeUrl
    };
})(typeof window !== 'undefined' ? window : this);
