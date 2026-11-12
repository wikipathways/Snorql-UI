"""Tests for snorql_examples.py, on small example repositories made in a temporary directory.

Run with: python -m pytest tools/examples
"""

import json
import pathlib
import subprocess
import sys

import pytest
from rdflib import Graph

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import snorql_examples as se  # noqa: E402

BASE = "https://example.org/sparql-examples/"

COLLECTION = f"""@prefix schema: <https://schema.org/> .
@prefix snorql: <https://w3id.org/snorql/ns#> .
@prefix void: <http://rdfs.org/ns/void#> .
<{BASE}> a snorql:ExampleCollection ; schema:name "Test examples" ;
    void:uriSpace "{BASE}" ; snorql:identifierPrefix "TQ" .
"""

CATEGORIES = """@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix cat: <https://example.org/category/> .
cat:General a skos:Concept ; skos:prefLabel "General"@en ; sh:order 1 .
cat:Sub a skos:Concept ; skos:prefLabel "Sub"@en ; skos:broader cat:General .
"""

CONTRIBUTORS = """@prefix schema: <https://schema.org/> .
<https://orcid.org/0000-0003-2230-0840> schema:name "Marvin Martens" .
"""

PREFIXES = f"""@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix param: <https://w3id.org/snorql/param#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix schema: <https://schema.org/> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix snorql: <https://w3id.org/snorql/ns#> .
@prefix spex: <https://purl.expasy.org/sparql-examples/ontology#> .
@prefix cat: <https://example.org/category/> .
@prefix ex: <{BASE}> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .
"""

QUERY = '''PREFIX ex: <http://example.org/>
SELECT ?s ?name WHERE {
  VALUES ?pathway { <https://identifiers.org/wikipathways/WP1560> }
  ?s ex:partOf ?pathway ; ex:name ?name .
  VALUES ?species { "Homo sapiens" }
  ?s ex:species ?species .
}'''


def example(ident="TQ001", version="1.0.0", query=QUERY, extra="", params=True, label="An example"):
    p = ""
    if params:
        p = '''    sh:parameter [ a sh:Parameter ; sh:path param:pathwayId ; snorql:variable "pathway" ;
        sh:name "Pathway" ; sh:defaultValue "WP1560" ; sh:nodeKind sh:IRI ;
        snorql:valueTemplate "https://identifiers.org/wikipathways/{value}" ; snorql:autocomplete "pathway" ; sh:order 1 ] ;
    sh:parameter [ a sh:Parameter ; sh:path param:species ; sh:name "Species" ;
        sh:defaultValue "Homo sapiens" ; sh:datatype xsd:string ; sh:order 2 ] ;
'''
    return PREFIXES + f'''
ex:{ident} a sh:SPARQLExecutable, sh:SPARQLSelectExecutable ;
    dcterms:identifier "{ident}" ;
    rdfs:label "{label}"@en ;
    rdfs:comment "What it does."@en ;
    schema:version "{version}" ;
    dcterms:created "2026-11-11"^^xsd:date ;
    dcterms:creator <https://orcid.org/0000-0003-2230-0840> ;
    dcterms:license <https://www.gnu.org/licenses/gpl-3.0.html> ;
    dcterms:subject cat:Sub ;
    schema:keywords "test" ;
    schema:target <https://example.org/sparql> ;
{extra}{p}    sh:select """{query}""" .
'''


class Repo:
    def __init__(self, path):
        self.path = path
        self.git("init", "-q", "-b", "master")
        self.git("config", "user.email", "t@example.org")
        self.git("config", "user.name", "Test")
        self.write("collection.ttl", COLLECTION)
        self.write("categories.ttl", CATEGORIES)
        self.write("contributors.ttl", CONTRIBUTORS)

    def git(self, *args):
        subprocess.run(["git", "-C", str(self.path), *args], check=True, capture_output=True)

    def write(self, rel, text):
        p = self.path / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(text, encoding="utf-8")

    def commit(self, msg="change"):
        self.git("add", "-A")
        self.git("commit", "-qm", msg)

    def run(self, *args):
        return se.main(["--repo", str(self.path), *args])


@pytest.fixture
def repo(tmp_path):
    r = Repo(tmp_path)
    r.write("A folder/first.ttl", example())
    r.commit("first")
    return r


def test_check_passes(repo, capsys):
    assert repo.run("check", "--no-shacl") == 0
    assert "1 examples" in capsys.readouterr().out


def test_shacl_profile_passes(repo):
    pytest.importorskip("pyshacl")
    assert repo.run("check") == 0


@pytest.mark.parametrize("change,message", [
    (lambda t: t.replace('dcterms:identifier "TQ001"', 'dcterms:identifier "TQ1"'), "does not look like"),
    (lambda t: t.replace("ex:TQ001 a", "ex:TQ002 a"), "the IRI must be"),
    (lambda t: t.replace('{ "Homo sapiens" }', '{ "Mus musculus" }'), "expected the default"),
    (lambda t: t.replace('  VALUES ?species { "Homo sapiens" }\n', ""), "exactly one `VALUES ?species"),
    (lambda t: t.replace('schema:version "1.0.0"', 'schema:version "1.0"'), "MAJOR.MINOR.PATCH"),
    (lambda t: t.replace("cat:Sub", "cat:Nope"), "not in categories.ttl"),
    (lambda t: t.replace("<https://orcid.org/0000-0003-2230-0840> ;", "<https://orcid.org/0000-0000-0000-0001> ;"),
     "no schema:name"),
    (lambda t: t.replace("?s ex:species ?species .", "?s ex:species ?species . SERVICE <https://other.org/sparql> { ?s ?p ?o }"),
     "does not match the SERVICE"),
    (lambda t: t.replace("SELECT ?s ?name WHERE {", "SELECT ?s ?name WHERE { {{x}}"), "placeholder"),
])
def test_check_finds_problems(repo, capsys, change, message):
    repo.write("A folder/first.ttl", change(example()))
    assert repo.run("check", "--no-shacl") == 1
    assert message in capsys.readouterr().err


def optional_species(text, default=False, block="UNDEF"):
    """The example with species as an optional parameter (no sh:defaultValue, VALUES UNDEF)."""
    if not default:
        text = text.replace('        sh:defaultValue "Homo sapiens" ; sh:datatype', "        sh:datatype")
    return text.replace('VALUES ?species { "Homo sapiens" }', "VALUES ?species { " + block + " }")


def test_optional_parameter(repo, tmp_path, capsys):
    repo.write("A folder/first.ttl", optional_species(example()))
    assert repo.run("check", "--no-shacl") == 0
    repo.commit("optional species")
    out = tmp_path / "out"
    assert repo.run("build", "--out", str(out), "--repository", "o/r") == 0
    e = json.loads((out / "index.json").read_text())["examples"][0]
    p = {x["name"]: x for x in e["params"]}
    assert p["species"]["optional"] is True and p["species"]["default"] == ""
    assert p["pathwayId"]["optional"] is False
    # The .rq export keeps UNDEF and has no param line for it, so old editors run it for all species.
    rq = (out / "rq" / "A folder" / "first.rq").read_text()
    assert "VALUES ?species { UNDEF }" in rq and "# param: species" not in rq
    assert "# param: pathwayId" in rq


@pytest.mark.parametrize("default,block", [(True, "UNDEF"), (False, '"Homo sapiens"')])
def test_optional_parameter_mismatch(repo, capsys, default, block):
    repo.write("A folder/first.ttl", optional_species(example(), default=default, block=block))
    assert repo.run("check", "--no-shacl") == 1
    assert "without sh:defaultValue" in capsys.readouterr().err


def test_optional_parameter_passes_shacl(repo):
    pytest.importorskip("pyshacl")
    repo.write("A folder/first.ttl", optional_species(example()))
    assert repo.run("check") == 0


def test_duplicate_identifier(repo, capsys):
    repo.write("other.ttl", example(label="Copy"))
    assert repo.run("check", "--no-shacl") == 1
    assert "also used in" in capsys.readouterr().err


def test_versions_moving_a_file_needs_no_bump(repo):
    repo.git("mv", "A folder/first.ttl", "renamed.ttl")
    assert repo.run("versions", "--base", "HEAD") == 0


def test_versions_change_without_bump(repo, capsys):
    repo.write("A folder/first.ttl", example(label="New title"))
    assert repo.run("versions", "--base", "HEAD") == 1
    assert "did not go up" in capsys.readouterr().err
    repo.write("A folder/first.ttl", example(label="New title", version="1.0.1"))
    assert repo.run("versions", "--base", "HEAD") == 0


def test_versions_query_change_needs_minor(repo, capsys):
    q = QUERY.replace("?s ex:species ?species .", "?s ex:species ?species . ?s a ex:Thing .")
    repo.write("A folder/first.ttl", example(query=q, version="1.0.1"))
    assert repo.run("versions", "--base", "HEAD") == 1
    assert "MINOR or MAJOR" in capsys.readouterr().err
    repo.write("A folder/first.ttl", example(query=q, version="1.1.0"))
    assert repo.run("versions", "--base", "HEAD") == 0


def test_versions_new_columns_need_major(repo, capsys):
    q = QUERY.replace("SELECT ?s ?name", "SELECT ?s")
    repo.write("A folder/first.ttl", example(query=q, version="1.1.0"))
    assert repo.run("versions", "--base", "HEAD") == 1
    assert "result columns changed" in capsys.readouterr().err
    repo.write("A folder/first.ttl", example(query=q, version="2.0.0"))
    assert repo.run("versions", "--base", "HEAD") == 0


def test_versions_removal_and_reuse(repo, capsys):
    repo.git("rm", "-q", "A folder/first.ttl")
    assert repo.run("versions", "--base", "HEAD") == 1
    assert "was removed" in capsys.readouterr().err
    repo.commit("removed")
    repo.write("again.ttl", example(label="Reused"))
    assert repo.run("versions", "--base", "HEAD") == 1
    assert "never reused" in capsys.readouterr().err


def test_next_id(repo, capsys):
    assert repo.run("next-id") == 0
    assert capsys.readouterr().out.strip() == "TQ002"


def test_build(repo, tmp_path):
    repo.write("A folder/first.ttl", example(label="Better title", version="1.0.1"))
    repo.commit("better title")
    (repo.path / "B").mkdir()
    repo.git("mv", "A folder/first.ttl", "B/moved.ttl")
    repo.commit("move")
    repo.git("tag", "v2026.11")
    out = tmp_path / "out"
    assert repo.run("build", "--out", str(out), "--repository", "o/r") == 0

    index = json.loads((out / "index.json").read_text())
    assert index["schema"] == 1
    assert [c["label"] for c in index["categories"]] == ["General", "Sub"]
    e = index["examples"][0]
    assert (e["id"], e["version"], e["label"], e["path"]) == ("TQ001", "1.0.1", "Better title", "B/moved.ttl")
    assert e["aliases"] == ["A folder/first.ttl"]
    assert e["creators"] == [{"iri": "https://orcid.org/0000-0003-2230-0840", "name": "Marvin Martens"}]
    assert e["modified"] is not None
    p = {x["name"]: x for x in e["params"]}
    assert p["pathwayId"]["variable"] == "pathway" and p["pathwayId"]["kind"] == "iri"
    assert p["species"]["kind"] == "literal" and p["species"]["default"] == "Homo sapiens"

    history = json.loads((out / "history.json").read_text())
    assert [h["version"] for h in history["examples"]["TQ001"]] == ["1.0.0", "1.0.1"]
    assert history["releases"]["v2026.11"]["versions"] == {"TQ001": "1.0.1"}
    old = json.loads((out / "versions" / "TQ001" / "1.0.0.json").read_text())
    assert old["label"] == "An example" and old["version"] == "1.0.0"

    combined = Graph().parse(out / "sparql-examples.ttl", format="turtle")
    assert len(combined) > 20

    rq = (out / "rq" / "B" / "moved.rq").read_text()
    assert "# title: Better title" in rq
    assert "# param: pathwayId|autocomplete:pathway|WP1560|Pathway" in rq
    assert "VALUES ?pathway { <https://identifiers.org/wikipathways/{{pathwayId}}> }" in rq
    assert 'VALUES ?species { "{{species}}" }' in rq


def test_stage_sib(repo, tmp_path):
    out = tmp_path / "sib"
    assert repo.run("stage-sib", "--out", str(out), "--project", "Test") == 0
    assert (out / "Test" / "TQ001.ttl").exists()
    prefixes = (out / "Test" / "prefixes.ttl").read_text()
    assert 'sh:prefix "ex"' in prefixes
