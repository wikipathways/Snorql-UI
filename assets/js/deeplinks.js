/*
 * Deep links to example queries.
 *
 *   ?example=<path of an .rq file in the examples repository>
 *   [&ref=<branch, tag or commit to read it from>]
 *   [&<param name>=<value>]...   values for the query's # param: fields
 *   [&endpoint=<endpoint URL>]
 *
 * For example ?example=D. General/GenesofPathway.rq&pathwayId=WP1560 opens
 * "Genes of a Pathway" with its description and parameter panel, for WP1560.
 * Without ref the configured examples branch is used, so the link always shows
 * the current version of the query; with ref it shows that version.
 *
 * Everything here is pure (no DOM, no network) so it can be unit tested;
 * snorql.js does the loading.
 */
(function (root) {
    'use strict';

    // URL parameters that are not query parameters.
    var RESERVED = ['example', 'ref', 'endpoint', 'q'];
    var MAX_VALUE_LENGTH = 500;

    // Read the deep-link parameters from a location.search string.
    // Returns { example, ref, values } where values holds the other parameters.
    function readParams(search) {
        var out = { example: null, ref: null, values: {} };
        var params = new URLSearchParams(search || '');
        params.forEach(function (value, key) {
            if (key === 'example') {
                out.example = value;
            } else if (key === 'ref') {
                out.ref = value;
            } else if (RESERVED.indexOf(key) === -1) {
                out.values[key] = value;
            }
        });
        return out;
    }

    // A relative path to an .rq file: no scheme, no "..", no empty segments.
    // Returns the cleaned path, or null when it is not acceptable.
    function sanitizeExamplePath(path) {
        if (typeof path !== 'string') return null;
        path = path.trim().replace(/^\/+/, '');
        if (!path || path.length > 300) return null;
        if (!/\.rq$/i.test(path)) return null;
        for (var c = 0; c < path.length; c++) {
            var code = path.charCodeAt(c);
            if (code < 32 || code === 127 || path.charAt(c) === '\\') return null;
        }
        if (/^[a-z][a-z0-9+.-]*:/i.test(path)) return null;
        var segments = path.split('/');
        for (var i = 0; i < segments.length; i++) {
            if (segments[i] === '' || segments[i] === '.' || segments[i] === '..') return null;
        }
        return path;
    }

    // A git branch, tag or commit hash. Returns it, or null when it is not acceptable.
    function sanitizeRef(ref) {
        if (typeof ref !== 'string') return null;
        ref = ref.trim();
        if (!/^[A-Za-z0-9._/-]{1,100}$/.test(ref)) return null;
        if (ref.indexOf('..') !== -1 || /^[/.-]/.test(ref) || /\/$/.test(ref)) return null;
        return ref;
    }

    function encodePath(path) {
        return path.split('/').map(encodeURIComponent).join('/');
    }

    // "owner/repo" for a GitHub examples repository URL, the URL itself for a
    // local development API (http://localhost...), or null.
    function repoPathFromUrl(repoUrl) {
        if (typeof repoUrl !== 'string') return null;
        repoUrl = repoUrl.trim().replace(/\/+$/, '');
        if (repoUrl.indexOf('http://localhost') === 0) return repoUrl;
        var m = /^https:\/\/github\.com\/([^/\s]+\/[^/\s]+)$/.exec(repoUrl);
        return m ? m[1] : null;
    }

    // URL of the raw .rq file, built the same way as the examples tree does.
    function rawUrl(repoPath, ref, path) {
        if (repoPath.indexOf('http://localhost') === 0) {
            return repoPath.replace('/api/repos/', '/raw/') + '/' + encodePath(path);
        }
        return 'https://raw.githubusercontent.com/' + repoPath + '/' + encodePath(ref) + '/' + encodePath(path);
    }

    // Path inside the repository for a raw GitHub URL of the examples tree
    // (fallback for trees cached before nodes carried their path).
    function pathFromRawHref(href) {
        var m = /^https:\/\/raw\.githubusercontent\.com\/[^/]+\/[^/]+\/[^/]+\/(.+)$/.exec(href || '');
        if (!m) return null;
        try {
            return sanitizeExamplePath(decodeURIComponent(m[1]));
        } catch (e) {
            return sanitizeExamplePath(m[1]);
        }
    }

    // Values from the link for the query's parameters. Unknown names are ignored,
    // enum values must be one of the options, other values are capped in length.
    // Returns { name: value } for the accepted values only.
    function acceptedValues(params, values) {
        var accepted = {};
        if (!params || !values) return accepted;
        for (var i = 0; i < params.length; i++) {
            var p = params[i];
            if (!Object.prototype.hasOwnProperty.call(values, p.name)) continue;
            var value = String(values[p.name]);
            if (value.length > MAX_VALUE_LENGTH) continue;
            if (p.type === 'enum') {
                var ok = false;
                for (var j = 0; p.options && j < p.options.length; j++) {
                    if (p.options[j].value === value) ok = true;
                }
                if (!ok) continue;
            }
            accepted[p.name] = value;
        }
        return accepted;
    }

    // Shareable link for an example. state:
    //   path, ref (optional), params: [{ name, value, defaultValue }],
    //   endpoint, defaultEndpoint (endpoint is only added when it differs).
    function buildExampleUrl(base, state) {
        var enc = function (s) { return encodeURIComponent(s).replace(/%2F/g, '/'); };
        var parts = ['example=' + enc(state.path)];
        if (state.ref) parts.push('ref=' + enc(state.ref));
        var params = state.params || [];
        for (var i = 0; i < params.length; i++) {
            var p = params[i];
            if (RESERVED.indexOf(p.name) !== -1) continue;
            if (p.value === null || p.value === undefined || p.value === p.defaultValue) continue;
            parts.push(encodeURIComponent(p.name) + '=' + enc(p.value));
        }
        if (state.endpoint && state.endpoint !== state.defaultEndpoint) {
            parts.push('endpoint=' + encodeURIComponent(state.endpoint));
        }
        return base + '?' + parts.join('&');
    }

    root.DeepLinks = {
        RESERVED: RESERVED,
        readParams: readParams,
        sanitizeExamplePath: sanitizeExamplePath,
        sanitizeRef: sanitizeRef,
        repoPathFromUrl: repoPathFromUrl,
        rawUrl: rawUrl,
        pathFromRawHref: pathFromRawHref,
        acceptedValues: acceptedValues,
        buildExampleUrl: buildExampleUrl
    };
})(typeof window !== 'undefined' ? window : this);
