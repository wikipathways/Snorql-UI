/**
 * branding.js - config-driven page branding, so an instance can rebrand the UI
 * from config.js (plus its own images and assets/css/theme.css) without editing
 * index.html.
 *
 * Optional keys on window.SNORQL_CONFIG. Any key left out keeps the markup in
 * index.html, so the default page is unchanged.
 *   logo:            { src, alt?, width?, height? }   navbar logo (#index-page img)
 *   favicon:         "path/or/url"                    <link rel="icon">
 *   endpointLabel:   "SPARQL Endpoint"                text before the endpoint field
 *   metaDescription: "..."                            <meta name="description">
 *   metaAuthor:      "..."                            <meta name="author">
 *   footer:          [ item, ... ]                    replaces the footer line
 *       item = "plain text"
 *            | { label, url, title? }                 link
 *            | { image, url?, alt?, height? }         image, optionally linked
 *
 * SECURITY / TRUST BOUNDARY: same rules as linkouts.js. Config values are
 * untrusted: text goes in via textContent only, link and image URLs are
 * allowlisted (http/https/mailto for links, http/https for images, relative
 * paths resolve against the page), and links get rel="noopener noreferrer".
 * There is deliberately no raw-HTML option.
 */
(function () {
    'use strict';

    var LINK_SCHEMES = ['http:', 'https:', 'mailto:'];
    var IMAGE_SCHEMES = ['http:', 'https:'];

    function sanitizeUrl(raw, schemes) {
        if (typeof raw !== 'string' || raw.trim() === '') return null;
        try {
            var base = (typeof window !== 'undefined' && window.location)
                ? window.location.href
                : 'http://localhost/';
            var u = new URL(raw, base);
            return schemes.indexOf(u.protocol) !== -1 ? u.href : null;
        } catch (e) {
            return null;
        }
    }

    // Image sizes are plain numbers (pixels); anything else is dropped.
    function sanitizeSize(v) {
        var n = Number(v);
        return (v !== '' && v != null && isFinite(n) && n > 0 && n < 2000) ? String(Math.round(n)) : null;
    }

    function text(v) {
        return String(v == null ? '' : v);
    }

    function buildImage(item) {
        var src = sanitizeUrl(item.image, IMAGE_SCHEMES);
        if (src === null) return null;
        var img = document.createElement('img');
        img.setAttribute('src', src);
        img.setAttribute('alt', text(item.alt));
        var h = sanitizeSize(item.height);
        if (h) img.setAttribute('height', h);
        return img;
    }

    function buildFooterItem(item) {
        if (typeof item === 'string' || typeof item === 'number') {
            return document.createTextNode(text(item));
        }
        if (!item || typeof item !== 'object') return null;

        var content = null;
        if (item.image != null) {
            content = buildImage(item);
            if (content === null) return null;
        } else if (item.label != null) {
            content = document.createTextNode(text(item.label));
        } else {
            return null;
        }

        if (item.url == null) return content;
        var href = sanitizeUrl(item.url, LINK_SCHEMES);
        if (href === null) return item.image != null ? content : document.createTextNode(text(item.label));

        var a = document.createElement('a');
        a.setAttribute('href', href);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
        if (item.title != null) a.setAttribute('title', text(item.title));
        a.appendChild(content);
        return a;
    }

    function renderFooter(items, container) {
        if (!Array.isArray(items) || !container) return;
        var p = document.createElement('p');
        for (var i = 0; i < items.length; i++) {
            var node = buildFooterItem(items[i]);
            if (node) p.appendChild(node);
        }
        while (container.firstChild) container.removeChild(container.firstChild);
        container.appendChild(p);
    }

    function setMeta(name, value) {
        if (value == null) return;
        var el = document.querySelector('meta[name="' + name + '"]');
        if (!el) {
            el = document.createElement('meta');
            el.setAttribute('name', name);
            document.head.appendChild(el);
        }
        el.setAttribute('content', text(value));
    }

    function applyBranding(config) {
        if (!config || typeof document === 'undefined') return;

        if (config.logo && typeof config.logo === 'object') {
            var img = document.querySelector('#index-page img');
            var src = sanitizeUrl(config.logo.src, IMAGE_SCHEMES);
            if (img && src !== null) {
                img.setAttribute('src', src);
                img.setAttribute('alt', text(config.logo.alt));
                var w = sanitizeSize(config.logo.width);
                var h = sanitizeSize(config.logo.height);
                if (w) { img.setAttribute('width', w); } else { img.removeAttribute('width'); }
                if (h) { img.setAttribute('height', h); } else { img.removeAttribute('height'); }
            }
        }

        if (config.favicon != null) {
            var icon = sanitizeUrl(config.favicon, IMAGE_SCHEMES);
            var link = document.querySelector('link[rel="icon"]');
            if (icon !== null && link) {
                link.setAttribute('href', icon);
                link.removeAttribute('type');
            }
        }

        if (config.endpointLabel != null) {
            var label = document.getElementById('endpoint-label');
            if (label) label.textContent = text(config.endpointLabel);
        }

        setMeta('description', config.metaDescription);
        setMeta('author', config.metaAuthor);

        if (config.footer != null) {
            var footer = document.querySelector('#footer .container-fluid');
            renderFooter(config.footer, footer);
        }
    }

    var Branding = {
        sanitizeUrl: sanitizeUrl,
        buildFooterItem: buildFooterItem,
        renderFooter: renderFooter,
        applyBranding: applyBranding
    };
    this.Branding = Branding;

    if (typeof window !== 'undefined' && typeof document !== 'undefined' && document.addEventListener) {
        var init = function () { applyBranding(window.SNORQL_CONFIG); };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', init);
        } else {
            init();
        }
    }
}).call(typeof globalThis !== 'undefined' ? globalThis : this);
