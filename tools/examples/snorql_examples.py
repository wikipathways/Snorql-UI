#!/usr/bin/env python3
"""Check and publish a repository of SPARQL examples for Snorql-UI.

An examples repository holds one Turtle file per example, in the format of SIB's
sparql-examples (https://github.com/sib-swiss/sparql-examples) with the Snorql
extension terms (https://w3id.org/snorql/ns#), plus:

  collection.ttl    the snorql:ExampleCollection: name, IRI base (void:uriSpace)
                    and identifier prefix of the examples
  categories.ttl    the categories as a SKOS concept scheme
  contributors.ttl  a schema:name for every creator and contributor IRI

Every example has a permanent identifier (dcterms:identifier, e.g. WPQ036) that
also ends its IRI. Files can be renamed and moved; links use the identifier.

Commands (run from anywhere, --repo points at the examples checkout):

  check      validate the working tree
  versions   check that changed examples got a higher version than at --base
  build      write the published index to --out: index.json, history.json,
             versions/<id>/<version>.json, sparql-examples.ttl and rq/ exports
  live       run every example against its endpoint, check snorql:expect
  next-id    print the next free identifier

See README.md next to this file for the file format and the published index.
"""

import argparse
import datetime
import json
import os
import pathlib
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request

from rdflib import Graph, Literal, Namespace, URIRef
from rdflib.compare import to_isomorphic
from rdflib.namespace import DCTERMS, OWL, RDF, RDFS, SKOS, VOID, XSD

SH = Namespace("http://www.w3.org/ns/shacl#")
SCHEMA = Namespace("https://schema.org/")
SPEX = Namespace("https://purl.expasy.org/sparql-examples/ontology#")
PROV = Namespace("http://www.w3.org/ns/prov#")
SNORQL = Namespace("https://w3id.org/snorql/ns#")
PARAM = Namespace("https://w3id.org/snorql/param#")

INDEX_SCHEMA = 1
# rdflib's SPARQL parser recurses deeply on long nested queries.
sys.setrecursionlimit(max(sys.getrecursionlimit(), 10000))
SEMVER = re.compile(r"^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$")
PARAM_NAME = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
# URL parameters of the user interface; a query parameter cannot use these names.
RESERVED_PARAMS = {"example", "ref", "version", "endpoint", "q"}
SUPPORT_FILES = {"collection.ttl", "categories.ttl", "contributors.ttl"}
EXCLUDED_DIRS = {".git", ".github", ".planning", "node_modules", "scripts", "tests"}

# Query form: (class, property) of the SIB format.
QUERY_FORMS = [
    ("select", SH.SPARQLSelectExecutable, SH.select),
    ("ask", SH.SPARQLAskExecutable, SH.ask),
    ("construct", SH.SPARQLConstructExecutable, SH.construct),
    ("describe", SPEX.SPARQLDescribeExecutable, SPEX.describe),
]


class ExampleError(Exception):
    pass


# ---------------------------------------------------------------- git

def git(repo, *args, check=True):
    r = subprocess.run(["git", "-C", str(repo), *args], capture_output=True, text=True)
    if check and r.returncode != 0:
        raise ExampleError(f"git {' '.join(args)}: {r.stderr.strip()}")
    return r.stdout


def git_show(repo, ref, path):
    return git(repo, "show", f"{ref}:{path}")


# ---------------------------------------------------------------- query text

def strip_strings_iris_comments(query, keep_iris=False):
    """Blank out comments, string literals and (unless keep_iris) IRIs."""
    out = []
    i, n = 0, len(query)
    while i < n:
        c = query[i]
        if c == "#":
            j = query.find("\n", i)
            i = n if j < 0 else j
        elif c == "<":
            j = query.find(">", i)
            # A '<' that is a comparison operator has whitespace or '=' after it.
            if j > 0 and not re.search(r"[\s]", query[i:j]):
                out.append(query[i:j + 1] if keep_iris else " ")
                i = j + 1
            else:
                out.append(c)
                i += 1
        elif c in "\"'":
            quote = query[i:i + 3] if query[i:i + 3] in ('"""', "'''") else c
            j = i + len(quote)
            while j < n and query[j:j + len(quote)] != quote:
                j += 2 if query[j] == "\\" else 1
            out.append(" ")
            i = j + len(quote)
        else:
            out.append(c)
            i += 1
    return "".join(out)


def services(query):
    code = strip_strings_iris_comments(query, keep_iris=True)
    return sorted(set(re.findall(r"(?i)\bSERVICE\s+(?:SILENT\s+)?<([^>]+)>", code)))


def declared_prefixes(query):
    code = strip_strings_iris_comments(query, keep_iris=True)
    return {m.group(1): m.group(2) for m in re.finditer(r"(?i)\bPREFIX\s+([\w.-]*)\s*:\s*<([^>]*)>", code)}


def mask(query):
    """Same-length copy of the query with comments, string literals and IRIs blanked out."""
    out = list(query)
    i, n = 0, len(query)

    def blank(a, b):
        for k in range(a, min(b, n)):
            if out[k] != "\n":
                out[k] = " "
    while i < n:
        c = query[i]
        if c == "#":
            j = query.find("\n", i)
            j = n if j < 0 else j
            blank(i, j)
            i = j
        elif c == "<":
            j = query.find(">", i)
            if j > 0 and not re.search(r"\s", query[i:j]):
                blank(i, j + 1)
                i = j + 1
            else:
                i += 1
        elif c in "\"'":
            quote = query[i:i + 3] if query[i:i + 3] in ('"""', "'''") else c
            j = i + len(quote)
            while j < n and query[j:j + len(quote)] != quote:
                j += 2 if query[j] == "\\" else 1
            blank(i, j + len(quote))
            i = j + len(quote)
        else:
            i += 1
    return "".join(out)


def values_blocks(query, name):
    """The terms of every `VALUES ?name { term }` block (one variable, one row)."""
    code = mask(query)
    blocks = []
    for m in re.finditer(r"(?i)\bVALUES\s+[?$]" + re.escape(name) + r"\s*\{", code):
        end = code.find("}", m.end())
        if end < 0:
            continue
        blocks.append(query[m.end():end].strip())
    return blocks


def parse_term(term, prefixes):
    """('iri', value), ('literal', value) or ('undef', None) for a single SPARQL term, or None."""
    term = term.strip()
    if term.upper() == "UNDEF":
        return "undef", None
    m = re.fullmatch(r"<([^<>\s]*)>", term)
    if m:
        return "iri", m.group(1)
    m = re.fullmatch(r'"((?:[^"\\\n]|\\.)*)"', term)
    if m:
        return "literal", re.sub(r"\\(.)", lambda e: {"n": "\n", "t": "\t", "r": "\r"}.get(e.group(1), e.group(1)),
                                 m.group(1))
    m = re.fullmatch(r"([A-Za-z][\w.-]*)?:([\w.%:-]*)", term)
    if m and (m.group(1) or "") in prefixes:
        return "iri", prefixes[m.group(1) or ""] + m.group(2)
    return None


def encode_value(value):
    """Percent-encode a user value for an IRI template, as encodeURIComponent does."""
    return urllib.parse.quote(value, safe="-_.!~*'()")


def projection(query):
    """Projected variable names of a SELECT query, or None if not a parsable SELECT."""
    try:
        from rdflib.plugins.sparql import prepareQuery
        q = prepareQuery(query)
    except Exception:
        return None
    if q.algebra.name != "SelectQuery":
        return None
    return [str(v) for v in q.algebra.get("PV", [])]


def check_syntax(query):
    """Parse the query with rdflib. A SERVICE nested in a SERVICE sends rdflib's parser
    into endless recursion; such queries are left to the SIB check (Jena, RDF4J)."""
    from rdflib.plugins.sparql import prepareQuery
    try:
        prepareQuery(query)
    except RecursionError:
        return
    except Exception as e:
        raise ExampleError(f"query does not parse: {str(e).splitlines()[0]}")


# ---------------------------------------------------------------- reading files

def is_example_path(rel):
    """True for a .ttl path (relative, with /) that can hold an example."""
    parts = rel.split("/")
    return (rel.endswith(".ttl") and rel not in SUPPORT_FILES
            and not any(p in EXCLUDED_DIRS or p.startswith(".") for p in parts[:-1]))


def example_files(repo):
    files = []
    for p in sorted(pathlib.Path(repo).rglob("*.ttl"), key=lambda p: str(p).casefold()):
        rel = p.relative_to(repo).as_posix()
        if is_example_path(rel):
            files.append(rel)
    return files


def parse_turtle(text, where):
    g = Graph()
    try:
        g.parse(data=text, format="turtle")
    except Exception as e:
        raise ExampleError(f"{where}: not valid Turtle: {str(e).splitlines()[0]}")
    return g


def load_support(repo, ref=None):
    """Collection, categories and contributors, merged into one graph."""
    g = Graph()
    for name in sorted(SUPPORT_FILES):
        if ref is None:
            p = pathlib.Path(repo) / name
            if not p.exists():
                raise ExampleError(f"{name} is missing")
            text = p.read_text(encoding="utf-8")
        else:
            text = git_show(repo, ref, name)
        g += parse_turtle(text, name)
    return g


class Collection:
    def __init__(self, support):
        subjects = list(support.subjects(RDF.type, SNORQL.ExampleCollection))
        if len(subjects) != 1:
            raise ExampleError("collection.ttl must describe exactly one snorql:ExampleCollection")
        s = subjects[0]
        self.iri = str(s)
        self.name = str(support.value(s, SCHEMA.name) or "")
        self.description = str(support.value(s, SCHEMA.description) or "")
        self.license = str(support.value(s, DCTERMS.license) or "")
        base = support.value(s, VOID.uriSpace)
        prefix = support.value(s, SNORQL.identifierPrefix)
        if base is None or prefix is None:
            raise ExampleError("the collection needs void:uriSpace and snorql:identifierPrefix")
        self.base = str(base)
        self.prefix = str(prefix)
        if not re.fullmatch(r"[A-Za-z]+", self.prefix):
            raise ExampleError("snorql:identifierPrefix must be letters only")
        self.id_pattern = re.compile(r"^" + re.escape(self.prefix) + r"(\d{3,})$")


def categories(support):
    """Categories as index entries, parents before children, in display order."""
    cats = {}
    for s in support.subjects(RDF.type, SKOS.Concept):
        label = support.value(s, SKOS.prefLabel)
        if label is None:
            raise ExampleError(f"category {s} has no skos:prefLabel")
        order = support.value(s, SH.order)
        broader = support.value(s, SKOS.broader)
        cats[str(s)] = {
            "iri": str(s),
            "label": str(label),
            "order": int(order) if order is not None else None,
            "notation": str(support.value(s, SKOS.notation) or ""),
            "parent": str(broader) if broader is not None else None,
        }
    for c in cats.values():
        if c["parent"] and c["parent"] not in cats:
            raise ExampleError(f"category {c['iri']}: skos:broader {c['parent']} is not a category")

    def key(c):
        return (c["order"] if c["order"] is not None else 10 ** 6, c["notation"], c["label"].casefold())
    out = []

    def add(parent):
        for c in sorted((c for c in cats.values() if c["parent"] == parent), key=key):
            out.append(c)
            add(c["iri"])
    add(None)
    return out


def names(support):
    return {str(s): str(o) for s, o in support.subject_objects(SCHEMA.name)}


def literal_text(v):
    return None if v is None else str(v)


def one(g, s, p, what, required=True):
    values = list(g.objects(s, p))
    if len(values) > 1:
        raise ExampleError(f"more than one {what}")
    if not values:
        if required:
            raise ExampleError(f"no {what}")
        return None
    return values[0]


def parse_param(g, node, query, prefixes):
    path = g.value(node, SH.path)
    if not isinstance(path, URIRef) or not str(path).startswith(str(PARAM)):
        raise ExampleError(f"a parameter's sh:path must be an IRI in {PARAM}")
    name = str(path)[len(str(PARAM)):]
    if not PARAM_NAME.match(name) or name in RESERVED_PARAMS:
        raise ExampleError(f"parameter name {name!r} is not allowed")
    label = g.value(node, SH.name)
    default = g.value(node, SH.defaultValue)
    if label is None:
        raise ExampleError(f"parameter {name}: sh:name is required")
    # Without sh:defaultValue the parameter is optional: the VALUES block holds UNDEF,
    # and an empty field in the editor leaves the variable unbound (no constraint).
    optional = default is None
    variable = literal_text(g.value(node, SNORQL.variable)) or name
    if not PARAM_NAME.match(variable):
        raise ExampleError(f"parameter {name}: snorql:variable {variable!r} is not a variable name")
    template = literal_text(g.value(node, SNORQL.valueTemplate))
    kind = "iri" if template is not None or g.value(node, SH.nodeKind) == SH.IRI else "literal"
    if template is not None and template.count("{value}") != 1:
        raise ExampleError(f"parameter {name}: snorql:valueTemplate must contain {{value}} once")
    options = []
    for o in g.objects(node, SNORQL.option):
        value = g.value(o, RDF.value)
        if value is None:
            raise ExampleError(f"parameter {name}: an option has no rdf:value")
        order = g.value(o, SH.order)
        options.append({"value": str(value), "label": str(g.value(o, RDFS.label) or value),
                        "_order": int(order) if order is not None else 10 ** 6})
    options.sort(key=lambda o: (o["_order"], o["label"].casefold()))
    for o in options:
        del o["_order"]
    if options and not optional and str(default) not in [o["value"] for o in options]:
        raise ExampleError(f"parameter {name}: the default is not one of the options")
    order = g.value(node, SH.order)
    param = {
        "name": name,
        "variable": variable,
        "label": str(label),
        "description": literal_text(g.value(node, SH.description)),
        "order": int(order) if order is not None else None,
        "kind": kind,
        "valueTemplate": template,
        "default": "" if optional else str(default),
        "optional": optional,
        "autocomplete": literal_text(g.value(node, SNORQL.autocomplete)),
        "options": options or None,
    }
    # The query binds the variable to the default in exactly one VALUES block.
    blocks = values_blocks(query, variable)
    if len(blocks) != 1:
        raise ExampleError(f"parameter {name}: the query needs exactly one `VALUES ?{variable} {{ ... }}` block, "
                           f"found {len(blocks)}")
    term = parse_term(blocks[0], prefixes)
    if term is None:
        raise ExampleError(f"parameter {name}: the VALUES block must hold one IRI, plain string or UNDEF")
    if optional or term[0] == "undef":
        if not (optional and term[0] == "undef"):
            raise ExampleError(f"parameter {name}: a parameter without sh:defaultValue needs `VALUES ?{variable} "
                               f"{{ UNDEF }}`, and an UNDEF block needs a parameter without sh:defaultValue")
        return param
    expected = (kind, template.replace("{value}", encode_value(param["default"])) if template else param["default"])
    if term != expected:
        raise ExampleError(f"parameter {name}: the VALUES block holds {term[1]!r}, expected the default "
                           f"{expected[1]!r} ({kind})")
    return param


def parse_example(g, s, collection, rel):
    """Index entry for example s in graph g (from file rel). Raises ExampleError."""
    ident = one(g, s, DCTERMS.identifier, "dcterms:identifier")
    ident = str(ident)
    if not collection.id_pattern.match(ident):
        raise ExampleError(f"identifier {ident!r} does not look like {collection.prefix}NNN")
    if str(s) != collection.base + ident:
        raise ExampleError(f"{ident}: the IRI must be {collection.base}{ident}, not {s}")
    try:
        label = one(g, s, RDFS.label, "rdfs:label")
        comments = [str(c) for c in g.objects(s, RDFS.comment)]
        if not comments:
            raise ExampleError("no rdfs:comment")
        version = str(one(g, s, SCHEMA.version, "schema:version"))
        if not SEMVER.match(version):
            raise ExampleError(f"schema:version {version!r} is not MAJOR.MINOR.PATCH")
        created = one(g, s, DCTERMS.created, "dcterms:created")
        if not isinstance(created, Literal) or created.datatype != XSD.date:
            raise ExampleError("dcterms:created must be an xsd:date")
        creators = sorted(str(c) for c in g.objects(s, DCTERMS.creator))
        if not creators:
            raise ExampleError("no dcterms:creator")
        license_ = one(g, s, DCTERMS.license, "dcterms:license")
        subjects = sorted(str(c) for c in g.objects(s, DCTERMS.subject))
        if not subjects:
            raise ExampleError("no dcterms:subject (category)")
        targets = sorted(str(t) for t in g.objects(s, SCHEMA.target))
        if not targets:
            raise ExampleError("no schema:target")
        forms = [(name, prop) for name, cls, prop in QUERY_FORMS if (s, prop, None) in g]
        if len(forms) != 1:
            raise ExampleError("needs exactly one of sh:select, sh:ask, sh:construct, spex:describe")
        form, prop = forms[0]
        query = str(one(g, s, prop, form))
        cls = dict((n, c) for n, c, _ in QUERY_FORMS)[form]
        if (s, RDF.type, cls) not in g or (s, RDF.type, SH.SPARQLExecutable) not in g:
            raise ExampleError(f"must be a sh:SPARQLExecutable and a {cls.n3(g.namespace_manager)}")
        if "{{" in query:
            raise ExampleError("the query still holds a {{placeholder}}; use a VALUES block and sh:parameter")
        check_syntax(query)
        federates = sorted(str(f) for f in g.objects(s, SPEX.federatesWith))
        used = services(query)
        if sorted(set(used)) != sorted(set(federates)):
            raise ExampleError(f"spex:federatesWith {federates} does not match the SERVICE calls {used}")
        prefixes = declared_prefixes(query)
        params = [parse_param(g, p, query, prefixes) for p in g.objects(s, SH.parameter)]
        params.sort(key=lambda p: (p["order"] if p["order"] is not None else 10 ** 6, p["name"]))
        if len({p["name"] for p in params}) != len(params):
            raise ExampleError("two parameters with the same name")
        expect = None
        e = g.value(s, SNORQL.expect)
        if e is not None:
            expect = {}
            for key, p in (("minResults", SNORQL.minResults), ("maxResults", SNORQL.maxResults)):
                v = g.value(e, p)
                if v is not None:
                    expect[key] = int(v)
        deprecated = g.value(s, OWL.deprecated)
        replaced = g.value(s, DCTERMS.isReplacedBy)
        level = g.value(s, SCHEMA.educationalLevel)
        tested = g.value(s, SNORQL.testedAgainst)
    except ExampleError as e:
        raise ExampleError(f"{ident}: {e}")
    return {
        "id": ident,
        "iri": str(s),
        "label": str(label),
        "description": "\n\n".join(comments),
        "version": version,
        "created": str(created),
        "modified": None,
        "creators": creators,
        "contributors": sorted(str(c) for c in g.objects(s, DCTERMS.contributor)),
        "license": str(license_),
        "categories": subjects,
        "keywords": sorted({str(k) for k in g.objects(s, SCHEMA.keywords)}, key=str.casefold),
        "level": literal_text(level),
        "target": targets[0],
        "federatesWith": federates,
        "references": sorted(str(r) for r in g.objects(s, DCTERMS.references)),
        "derivedFrom": sorted(str(r) for r in g.objects(s, PROV.wasDerivedFrom)),
        "testedAgainst": literal_text(tested),
        "deprecated": bool(deprecated is not None and deprecated.toPython() is True),
        "replacedBy": str(replaced) if replaced is not None else None,
        "queryType": form,
        "query": query,
        "params": params,
        "expect": expect,
        "path": rel,
        "aliases": sorted(str(a) for a in g.objects(s, SNORQL.alias)),
    }


def examples_in(text, rel, collection):
    """[(entry, graph of the example)] for one file. Raises ExampleError."""
    g = parse_turtle(text, rel)
    subjects = sorted(set(g.subjects(RDF.type, SH.SPARQLExecutable)))
    if len(subjects) != 1:
        raise ExampleError(f"{rel}: must describe exactly one sh:SPARQLExecutable, found {len(subjects)}")
    s = subjects[0]
    entry = parse_example(g, s, collection, rel)
    return entry, g


def load_tree(repo, collection, errors):
    """{id: (entry, graph)} for the working tree; problems go to errors."""
    found = {}
    for rel in example_files(repo):
        try:
            entry, g = examples_in((pathlib.Path(repo) / rel).read_text(encoding="utf-8"), rel, collection)
        except ExampleError as e:
            errors.append(f"{rel}: {e}" if not str(e).startswith(rel) else str(e))
            continue
        if entry["id"] in found:
            errors.append(f"{rel}: identifier {entry['id']} is also used in {found[entry['id']][0]['path']}")
            continue
        found[entry["id"]] = (entry, g)
    return found


def load_ref(repo, ref, collection):
    """{id: (entry, graph)} for the .ttl files at a git ref; unreadable files are skipped."""
    found = {}
    listing = git(repo, "ls-tree", "-r", "--name-only", ref).splitlines()
    for rel in listing:
        if not is_example_path(rel):
            continue
        try:
            entry, g = examples_in(git_show(repo, ref, rel), rel, collection)
        except ExampleError:
            continue
        found[entry["id"]] = (entry, g)
    return found


# ---------------------------------------------------------------- checks

def cross_checks(found, support, errors):
    known = names(support)
    cats = {c["iri"] for c in categories(support)}
    aliases = {}
    for ident, (e, _) in sorted(found.items()):
        for person in e["creators"] + e["contributors"]:
            if person not in known:
                errors.append(f"{ident}: {person} has no schema:name in contributors.ttl")
        for c in e["categories"]:
            if c not in cats:
                errors.append(f"{ident}: category {c} is not in categories.ttl")
        if e["replacedBy"] and not any(o["iri"] == e["replacedBy"] for o, _ in found.values()):
            errors.append(f"{ident}: dcterms:isReplacedBy {e['replacedBy']} is not an example here")
        for a in e["aliases"] + [e["path"]]:
            if a in aliases and aliases[a] != ident:
                errors.append(f"{ident}: path {a!r} also names {aliases[a]}")
            aliases[a] = ident


def shacl_check(found, support, errors):
    shapes = pathlib.Path(__file__).with_name("shapes.ttl")
    try:
        from pyshacl import validate
    except ImportError:
        print("pyshacl is not installed; skipping the SHACL check", file=sys.stderr)
        return
    data = Graph()
    for _, g in found.values():
        data += g
    data += support
    conforms, _, text = validate(data, shacl_graph=Graph().parse(shapes, format="turtle"), inference="none")
    if not conforms:
        errors.append("SHACL validation failed:\n" + text)


def cmd_check(args):
    repo = pathlib.Path(args.repo)
    errors = []
    support = load_support(repo)
    collection = Collection(support)
    found = load_tree(repo, collection, errors)
    cross_checks(found, support, errors)
    if not args.no_shacl:
        shacl_check(found, support, errors)
    active = sum(1 for e, _ in found.values() if not e["deprecated"])
    print(f"{len(found)} examples ({active} active, {len(found) - active} deprecated) in {repo}")
    return report(errors)


def report(errors):
    for e in errors:
        print("ERROR: " + e, file=sys.stderr)
    return 1 if errors else 0


def semver(v):
    return tuple(int(x) for x in v.split("."))


def comparable(entry):
    return {"query": entry["query"], "params": entry["params"], "queryType": entry["queryType"]}


def version_problems(old, new):
    """Problems with the version of an example that changed from old to new."""
    (eo, go), (en, gn) = old, new
    if to_isomorphic(go) == to_isomorphic(gn):
        return []  # unchanged, or only moved or renamed
    vo, vn = semver(eo["version"]), semver(en["version"])
    if vn <= vo:
        return [f"{en['id']} changed but its version did not go up (still {en['version']}; was {eo['version']})"]
    problems = []
    if comparable(eo) != comparable(en) and vn[:2] == vo[:2]:
        problems.append(f"{en['id']}: the query or its parameters changed, so the MINOR or MAJOR version "
                        f"must go up ({eo['version']} -> {en['version']} only raises PATCH)")
    po, pn = projection(eo["query"]), projection(en["query"])
    if po is not None and pn is not None and po != pn and vn[0] == vo[0]:
        problems.append(f"{en['id']}: the result columns changed ({', '.join(po)} -> {', '.join(pn)}), "
                        f"so the MAJOR version must go up ({eo['version']} -> {en['version']})")
    return problems


def cmd_versions(args):
    repo = pathlib.Path(args.repo)
    errors = []
    support = load_support(repo)
    collection = Collection(support)
    head = load_tree(repo, collection, errors)
    base = load_ref(repo, args.base, collection)
    ever = set(base) | set(history_entries(repo, args.base, collection)[0])
    for ident in sorted(base):
        if ident not in head:
            errors.append(f"{ident} was removed; keep the file and mark it owl:deprecated true instead")
    for ident in sorted(head):
        if ident in base:
            errors += version_problems(base[ident], head[ident])
        elif ident in ever:
            errors.append(f"{ident} was used before; identifiers are never reused (next free: "
                          f"{next_id(collection, ever | set(head))})")
    changed = sum(1 for i in head if i in base and to_isomorphic(base[i][1]) != to_isomorphic(head[i][1]))
    print(f"compared with {args.base}: {changed} changed, {len(set(head) - set(base))} new")
    return report(errors)


def next_id(collection, idents):
    numbers = [int(collection.id_pattern.match(i).group(1)) for i in idents if collection.id_pattern.match(i)]
    return f"{collection.prefix}{(max(numbers) if numbers else 0) + 1:03d}"


def cmd_next_id(args):
    repo = pathlib.Path(args.repo)
    support = load_support(repo)
    collection = Collection(support)
    errors = []
    idents = set(load_tree(repo, collection, errors))
    try:
        idents |= set(history_entries(repo, "HEAD", collection)[0])
    except ExampleError:
        pass  # no git history
    print(next_id(collection, idents))
    return 0


# ---------------------------------------------------------------- history

def first_parent_changes(repo, ref):
    """[(commit, date, [(status, path)])] oldest first, for .ttl files on the first-parent line."""
    out = git(repo, "log", "--first-parent", "-m", "--reverse", "--format=%x00%H%x09%cs",
              "--name-status", "--no-renames", ref, "--", "*.ttl")
    commits = []
    for block in out.split("\x00")[1:]:
        lines = [line for line in block.split("\n") if line.strip()]
        sha, date = lines[0].split("\t")
        changes = []
        for line in lines[1:]:
            status, path = line.split("\t", 1)
            changes.append((status[0], path))
        commits.append((sha, date, changes))
    return commits


def history_entries(repo, ref, collection):
    """({id: [{version, commit, date, path}]}, {(id, version): entry}, {id: set(paths)})."""
    versions, snapshots, paths = {}, {}, {}
    for sha, date, changes in first_parent_changes(repo, ref):
        for status, rel in changes:
            if status == "D" or not is_example_path(rel):
                continue
            try:
                entry, _ = examples_in(git_show(repo, sha, rel), rel, collection)
            except ExampleError:
                continue
            ident = entry["id"]
            paths.setdefault(ident, set()).add(rel)
            seen = versions.setdefault(ident, [])
            if seen and seen[-1]["version"] == entry["version"]:
                continue
            seen.append({"version": entry["version"], "commit": sha, "date": date, "path": rel})
            entry["modified"] = date
            entry["commit"] = sha
            snapshots[(ident, entry["version"])] = entry
    return versions, snapshots, paths


def release_versions(repo, collection):
    """{tag: {commit, date, versions: {id: version}}} for tags on HEAD's history."""
    releases = {}
    for tag in git(repo, "tag", "--merged", "HEAD").split():
        sha = git(repo, "rev-list", "-n", "1", tag).strip()
        date = git(repo, "show", "-s", "--format=%cs", sha).strip()
        found = load_ref(repo, sha, collection)
        if found:
            releases[tag] = {"commit": sha, "date": date,
                             "versions": {i: e["version"] for i, (e, _) in sorted(found.items())}}
    return releases


# ---------------------------------------------------------------- build

def person(iri, known):
    return {"iri": iri, "name": known.get(iri, iri)}


def published(entry, known):
    e = dict(entry)
    e["creators"] = [person(p, known) for p in entry["creators"]]
    e["contributors"] = [person(p, known) for p in entry["contributors"]]
    e.pop("commit", None)
    return e


def rq_export(entry, repository, commit, category_labels):
    """A .rq file with the old comment header, for tools and Snorql versions that read .rq files."""
    query = entry["query"]
    header = [
        f"# title: {entry['label']}",
        f"# category: {category_labels.get(entry['categories'][0], '')}",
    ]
    desc = " ".join(entry["description"].split())
    header.append(f"# description: {desc}")
    for p in entry["params"]:
        if p.get("optional"):
            continue  # the VALUES block keeps UNDEF, so the query runs without the parameter
        if p["options"]:
            ptype = "enum:" + ",".join(f"{o['value']}={o['label']}" for o in p["options"])
        elif p["autocomplete"]:
            ptype = "autocomplete:" + p["autocomplete"]
        elif p["kind"] == "iri" and not p["valueTemplate"]:
            ptype = "uri"
        else:
            ptype = "string"
        header.append(f"# param: {p['name']}|{ptype}|{p['default']}|{p['label']}")
        # Put a {{placeholder}} back in the VALUES block so the old templating fills it in.
        if p["kind"] == "iri":
            term = "<" + (p["valueTemplate"] or "{value}").replace("{value}", "{{" + p["name"] + "}}") + ">"
        else:
            term = '"{{' + p["name"] + '}}"'
        query = re.sub(r"(?i)(\bVALUES\s+[?$]" + re.escape(p["variable"]) + r"\s*\{)[^}]*(\})",
                       lambda m: m.group(1) + " " + term + " " + m.group(2), query, count=1)
    header.append("#")
    header.append(f"# {entry['id']} version {entry['version']}, {entry['iri']}")
    header.append(f"# Generated from {entry['path']} in {repository} at {commit[:12]}; edit the .ttl file, not this one.")
    return "\n".join(header) + "\n\n" + query.rstrip("\n") + "\n"


def write_json(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def cmd_build(args):
    repo = pathlib.Path(args.repo)
    out = pathlib.Path(args.out)
    errors = []
    support = load_support(repo)
    collection = Collection(support)
    found = load_tree(repo, collection, errors)
    cross_checks(found, support, errors)
    if errors:
        return report(errors)
    known = names(support)
    cats = categories(support)
    labels = {c["iri"]: c["label"] for c in cats}
    commit = git(repo, "rev-parse", "HEAD").strip()
    repository = args.repository or os.environ.get("GITHUB_REPOSITORY", "")

    versions, snapshots, paths = history_entries(repo, "HEAD", collection)
    for ident, (e, _) in found.items():
        hist = versions.get(ident, [])
        current = [h for h in hist if h["version"] == e["version"]]
        e["modified"] = current[0]["date"] if current else None
        old = sorted((paths.get(ident, set()) | set(e["aliases"])) - {e["path"]}, key=str.casefold)
        e["aliases"] = old

    index = {
        "schema": INDEX_SCHEMA,
        "generated": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "repository": repository,
        "commit": commit,
        "collection": {"iri": collection.iri, "name": collection.name, "description": collection.description,
                       "license": collection.license, "iriBase": collection.base, "idPrefix": collection.prefix},
        "categories": cats,
        "examples": [published(e, known) for _, (e, _) in sorted(found.items())],
    }
    write_json(out / "index.json", index)

    history = {"schema": INDEX_SCHEMA, "examples": {i: v for i, v in sorted(versions.items()) if i in found},
               "releases": release_versions(repo, collection)}
    write_json(out / "history.json", history)
    for (ident, version), entry in snapshots.items():
        if ident not in found:
            continue
        snap = published(entry, known)
        snap["commit"] = entry["commit"]
        snap["aliases"] = found[ident][0]["aliases"]
        write_json(out / "versions" / ident / f"{version}.json", snap)

    combined = Graph()
    combined.namespace_manager.bind("snorql", SNORQL)
    combined.namespace_manager.bind("param", PARAM)
    combined.namespace_manager.bind("spex", SPEX)
    combined.namespace_manager.bind("schema", SCHEMA)
    combined.namespace_manager.bind("sh", SH)
    combined += support
    for _, g in found.values():
        combined += g
    (out / "sparql-examples.ttl").write_text(combined.serialize(format="turtle"), encoding="utf-8")

    for e, _ in found.values():
        rq = out / "rq" / re.sub(r"\.ttl$", ".rq", e["path"])
        rq.parent.mkdir(parents=True, exist_ok=True)
        rq.write_text(rq_export(e, repository, commit, labels), encoding="utf-8")

    print(f"wrote {len(found)} examples, {len(snapshots)} versions and {len(history['releases'])} releases to {out}")
    return 0


# ---------------------------------------------------------------- SIB layout

def cmd_stage_sib(args):
    """Copy the examples into the layout of SIB's sparql-examples-utils test:
    <out>/<project>/<id>.ttl plus a prefixes.ttl declaring every PREFIX used."""
    repo = pathlib.Path(args.repo)
    errors = []
    support = load_support(repo)
    collection = Collection(support)
    found = load_tree(repo, collection, errors)
    if errors:
        return report(errors)
    out = pathlib.Path(args.out) / args.project
    out.mkdir(parents=True, exist_ok=True)
    prefixes = {}
    for ident, (e, _) in sorted(found.items()):
        (out / f"{ident}.ttl").write_text((repo / e["path"]).read_text(encoding="utf-8"), encoding="utf-8")
        for p, ns in declared_prefixes(e["query"]).items():
            prefixes.setdefault(p, ns)
    lines = ["@prefix sh: <http://www.w3.org/ns/shacl#> .", "@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .", ""]
    for p, ns in sorted(prefixes.items()):
        lines.append(f'[] sh:declare [ sh:prefix "{p}" ; sh:namespace "{ns}"^^xsd:anyURI ] .')
    (out / "prefixes.ttl").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"staged {len(found)} examples and {len(prefixes)} prefixes in {out}")
    return 0


# ---------------------------------------------------------------- live test

def run_query(endpoint, query, form, timeout):
    accept = "application/n-triples" if form in ("construct", "describe") else "application/sparql-results+json"
    data = urllib.parse.urlencode({"query": query}).encode()
    req = urllib.request.Request(endpoint, data=data, headers={
        "Accept": accept, "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "snorql-examples-live-test"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        body = r.read().decode("utf-8", "replace")
    if form in ("construct", "describe"):
        return sum(1 for line in body.splitlines() if line.strip() and not line.startswith("#"))
    doc = json.loads(body)
    if form == "ask":
        return 1 if doc.get("boolean") else 0
    return len(doc["results"]["bindings"])


def cmd_live(args):
    repo = pathlib.Path(args.repo)
    errors = []
    support = load_support(repo)
    collection = Collection(support)
    found = load_tree(repo, collection, errors)
    if errors:
        return report(errors)
    rows, failed = [], 0
    only = set(args.only or [])
    for ident, (e, _) in sorted(found.items()):
        if e["deprecated"] or (only and ident not in only):
            continue
        start = datetime.datetime.now()
        try:
            n = run_query(e["target"], e["query"], e["queryType"], args.timeout)
            note = ""
        except (urllib.error.URLError, OSError, ValueError, KeyError) as ex:
            n, note = None, str(ex)[:120]
        secs = (datetime.datetime.now() - start).total_seconds()
        exp = e["expect"] or {}
        ok = n is not None and n >= exp.get("minResults", 0) and ("maxResults" not in exp or n <= exp["maxResults"])
        if n is not None and not e["expect"] and n == 0:
            note = note or "no results (no snorql:expect set)"
        if not ok:
            failed += 1
        rows.append(f"| {ident} | {e['label']} | {'' if n is None else n} | {secs:.1f} s | "
                    f"{'ok' if ok else 'FAIL'} {note} |")
    table = ["| ID | Example | Results | Time | Status |", "|---|---|---|---|---|"] + rows
    print("\n".join(table))
    summary = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary:
        with open(summary, "a", encoding="utf-8") as f:
            f.write("\n".join(table) + "\n")
    print(f"{len(rows)} examples run, {failed} failed", file=sys.stderr)
    return 1 if failed else 0


# ---------------------------------------------------------------- main

def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--repo", default=".", help="examples repository checkout (default: .)")
    sub = ap.add_subparsers(dest="cmd", required=True)
    c = sub.add_parser("check", help="validate the working tree")
    c.add_argument("--no-shacl", action="store_true", help="skip the SHACL validation")
    v = sub.add_parser("versions", help="check version bumps against a base commit")
    v.add_argument("--base", required=True, help="git ref to compare with, e.g. origin/master")
    b = sub.add_parser("build", help="write the published index")
    b.add_argument("--out", required=True, help="output directory")
    b.add_argument("--repository", help="owner/repo, for the .rq export headers (default: $GITHUB_REPOSITORY)")
    lv = sub.add_parser("live", help="run the examples against their endpoints")
    lv.add_argument("--timeout", type=int, default=120, help="seconds per query (default 120)")
    lv.add_argument("--only", nargs="*", help="identifiers to run (default: all active examples)")
    sub.add_parser("next-id", help="print the next free identifier")
    st = sub.add_parser("stage-sib", help="lay the examples out for SIB's sparql-examples-utils test")
    st.add_argument("--out", required=True, help="directory to write <project>/<id>.ttl into")
    st.add_argument("--project", default="Examples", help="project folder name (default: Examples)")
    args = ap.parse_args(argv)
    try:
        return {"check": cmd_check, "versions": cmd_versions, "build": cmd_build,
                "live": cmd_live, "next-id": cmd_next_id, "stage-sib": cmd_stage_sib}[args.cmd](args)
    except ExampleError as e:
        return report([str(e)])


if __name__ == "__main__":
    sys.exit(main())
