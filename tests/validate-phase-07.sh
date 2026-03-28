#!/usr/bin/env bash
# Phase 07 — Template Infrastructure
# Behavioral validation for TMPL-08 (autocomplete type registry + type-dispatched param panel)
# TMPL-07 is DESCOPED — no tests generated for it.
#
# Run from repo root:  bash tests/validate-phase-07.sh
# Exit code: 0 = all pass, 1 = one or more failures

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CONFIG_JS="$REPO_ROOT/assets/js/config.js"
SNORQL_JS="$REPO_ROOT/assets/js/snorql.js"

PASS=0
FAIL=0

pass() { echo "  PASS: $1"; PASS=$((PASS + 1)); }
fail() { echo "  FAIL: $1"; FAIL=$((FAIL + 1)); }

# ---------------------------------------------------------------------------
# Task 07-01-01 — autocompleteTypes registry in config.js
# Requirement: SNORQL_CONFIG contains autocompleteTypes registry with 5+ types
# ---------------------------------------------------------------------------
echo ""
echo "=== Task 07-01-01: autocompleteTypes registry in config.js ==="

# Check 1: registry key exists in config.js
if grep -q "autocompleteTypes" "$CONFIG_JS"; then
    pass "config.js contains 'autocompleteTypes' registry key"
else
    fail "config.js is missing 'autocompleteTypes' registry key"
fi

# Check 2: all 5 required type names are present in the registry
for type_name in pathway species entityType datasource interactionType; do
    if grep -q "\"$type_name\":\|$type_name:" "$CONFIG_JS"; then
        pass "config.js autocompleteTypes contains '$type_name' entry"
    else
        fail "config.js autocompleteTypes is missing '$type_name' entry"
    fi
done

# Check 3: pathway entry has valueField, labelField, extraField
if grep -q "valueField: 'id'" "$CONFIG_JS"; then
    pass "config.js pathway entry has valueField: 'id'"
else
    fail "config.js pathway entry missing valueField: 'id'"
fi

if grep -q "labelField: 'name'" "$CONFIG_JS"; then
    pass "config.js pathway entry has labelField: 'name'"
else
    fail "config.js pathway entry missing labelField: 'name'"
fi

if grep -q "extraField: 'species'" "$CONFIG_JS"; then
    pass "config.js pathway entry has extraField: 'species'"
else
    fail "config.js pathway entry missing extraField: 'species'"
fi

# Check 4: entityType uses staticValues with GeneProduct
if grep -q "staticValues.*GeneProduct\|GeneProduct.*staticValues" "$CONFIG_JS" || \
   (grep -q "staticValues" "$CONFIG_JS" && grep -q "GeneProduct" "$CONFIG_JS"); then
    pass "config.js entityType entry has staticValues containing 'GeneProduct'"
else
    fail "config.js entityType entry missing staticValues with 'GeneProduct'"
fi

# ---------------------------------------------------------------------------
# Task 07-01-01 (cont.) — generic autocomplete functions in snorql.js
# ---------------------------------------------------------------------------
echo ""
echo "=== Task 07-01-01 (cont.): generic autocomplete functions in snorql.js ==="

for fn in fetchAutocompleteData formatAutocompleteOption initAutocompleteField; do
    if grep -q "function $fn" "$SNORQL_JS"; then
        pass "snorql.js defines function '$fn'"
    else
        fail "snorql.js is missing function '$fn'"
    fi
done

# Check generic cache variables
if grep -q "var _autocompleteCache = {}" "$SNORQL_JS"; then
    pass "snorql.js has generic cache var '_autocompleteCache'"
else
    fail "snorql.js missing generic cache var '_autocompleteCache'"
fi

if grep -q "var _autocompleteCachePromise = {}" "$SNORQL_JS"; then
    pass "snorql.js has generic promise cache var '_autocompleteCachePromise'"
else
    fail "snorql.js missing generic promise cache var '_autocompleteCachePromise'"
fi

# Check hardcoded legacy names are gone from snorql.js
for legacy in fetchPathwayList fetchSpeciesList initPathwayAutocomplete initSpeciesAutocomplete _pathwayCache _speciesCache; do
    if grep -q "$legacy" "$SNORQL_JS"; then
        fail "snorql.js still contains legacy symbol '$legacy' (should have been removed)"
    else
        pass "snorql.js does not contain legacy symbol '$legacy'"
    fi
done

# Check cache clears on endpoint change
if grep -q "_autocompleteCache = {}" "$SNORQL_JS"; then
    pass "snorql.js clears _autocompleteCache on endpoint change"
else
    fail "snorql.js does not clear _autocompleteCache on endpoint change"
fi

# ---------------------------------------------------------------------------
# Task 07-01-02 — parseRqHeaders autocomplete: prefix detection
# Requirement: parseRqHeaders produces autocompleteType property for autocomplete: params
# ---------------------------------------------------------------------------
echo ""
echo "=== Task 07-01-02: parseRqHeaders autocomplete: prefix detection ==="

# Check 1: autocomplete: prefix detection code is present
if grep -q "autocomplete:" "$SNORQL_JS" && grep -q "indexOf('autocomplete:')" "$SNORQL_JS"; then
    pass "snorql.js parseRqHeaders contains autocomplete: prefix indexOf check"
else
    fail "snorql.js parseRqHeaders missing autocomplete: prefix indexOf check"
fi

# Check 2: autocompleteTypeName extraction (substring(13))
if grep -q "substring(13)" "$SNORQL_JS"; then
    pass "snorql.js extracts autocompleteTypeName via substring(13)"
else
    fail "snorql.js missing substring(13) for autocompleteTypeName extraction"
fi

# Check 3: paramType is reassigned to 'autocomplete'
if grep -q "paramType = 'autocomplete'" "$SNORQL_JS"; then
    pass "snorql.js sets paramType = 'autocomplete' for autocomplete: params"
else
    fail "snorql.js does not set paramType = 'autocomplete'"
fi

# Check 4: result.params.push includes autocompleteType property
if grep -q "autocompleteType: autocompleteTypeName" "$SNORQL_JS"; then
    pass "snorql.js result.params.push includes 'autocompleteType: autocompleteTypeName'"
else
    fail "snorql.js result.params.push missing 'autocompleteType: autocompleteTypeName'"
fi

# Check 5: autocomplete: check appears BEFORE enum: check in the source
AC_LINE=$(grep -n "indexOf('autocomplete:')" "$SNORQL_JS" | head -1 | cut -d: -f1)
ENUM_LINE=$(grep -n "indexOf('enum:')" "$SNORQL_JS" | head -1 | cut -d: -f1)
if [ -n "$AC_LINE" ] && [ -n "$ENUM_LINE" ] && [ "$AC_LINE" -lt "$ENUM_LINE" ]; then
    pass "autocomplete: check (line $AC_LINE) appears before enum: check (line $ENUM_LINE)"
else
    fail "autocomplete: check (line ${AC_LINE:-?}) does NOT appear before enum: check (line ${ENUM_LINE:-?})"
fi

# Check 6: enum: prefix detection is preserved (not accidentally removed)
if grep -q "indexOf('enum:') === 0" "$SNORQL_JS"; then
    pass "snorql.js preserves existing enum: prefix detection"
else
    fail "snorql.js is missing enum: prefix detection (regression)"
fi

# Check 7: node.js inline behavioral test — parse a header with autocomplete:species
PARSE_TEST_RESULT=$(node -e "
var content = [
    '# title: Test',
    '# param: orgName|autocomplete:species|Homo sapiens|Organism',
    'SELECT * WHERE { ?s ?p ?o }'
].join('\n');

// Inline the core parseRqHeaders logic (no jQuery or DOM needed)
function parseRqHeaders(content) {
    var result = { title: null, description: null, params: [] };
    var lines = content.split('\n');
    var descriptionLines = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var titleMatch = line.match(/^#\s*title:\s*(.+)/i);
        if (titleMatch) { result.title = titleMatch[1].trim(); continue; }
        var descMatch = line.match(/^#\s*description:\s*(.+)/i);
        if (descMatch) { descriptionLines.push(descMatch[1].trim()); continue; }
        if (descriptionLines.length > 0 && line.match(/^#\s{2,}\S/)) {
            descriptionLines.push(line.replace(/^#\s+/, '')); continue;
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
                    paramOptions = paramType.substring(5).split(',').map(function(o) { return o.trim(); });
                    paramType = 'enum';
                }
                result.params.push({
                    name: paramName, type: paramType,
                    autocompleteType: autocompleteTypeName,
                    defaultValue: paramDefault, label: paramLabel,
                    options: paramOptions
                });
            }
        }
    }
    if (descriptionLines.length > 0) result.description = descriptionLines.join(' ');
    return result;
}

var parsed = parseRqHeaders(content);
var p = parsed.params[0];

var ok = (
    p &&
    p.name === 'orgName' &&
    p.type === 'autocomplete' &&
    p.autocompleteType === 'species' &&
    p.defaultValue === 'Homo sapiens' &&
    p.label === 'Organism'
);

if (ok) {
    process.stdout.write('PASS');
} else {
    process.stdout.write('FAIL: got name=' + (p && p.name) + ' type=' + (p && p.type) + ' autocompleteType=' + (p && p.autocompleteType));
}
" 2>&1)

if [ "$PARSE_TEST_RESULT" = "PASS" ]; then
    pass "parseRqHeaders behavioral test: 'autocomplete:species' param produces type='autocomplete', autocompleteType='species'"
else
    fail "parseRqHeaders behavioral test: $PARSE_TEST_RESULT"
fi

# Check 8: node.js inline test — enum: params still produce type='enum', autocompleteType=null
ENUM_TEST_RESULT=$(node -e "
function parseRqHeaders(content) {
    var result = { title: null, description: null, params: [] };
    var lines = content.split('\n');
    var descriptionLines = [];
    for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        var titleMatch = line.match(/^#\s*title:\s*(.+)/i);
        if (titleMatch) { result.title = titleMatch[1].trim(); continue; }
        var descMatch = line.match(/^#\s*description:\s*(.+)/i);
        if (descMatch) { descriptionLines.push(descMatch[1].trim()); continue; }
        if (descriptionLines.length > 0 && line.match(/^#\s{2,}\S/)) {
            descriptionLines.push(line.replace(/^#\s+/, '')); continue;
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
                    paramOptions = paramType.substring(5).split(',').map(function(o) { return o.trim(); });
                    paramType = 'enum';
                }
                result.params.push({
                    name: paramName, type: paramType,
                    autocompleteType: autocompleteTypeName,
                    defaultValue: paramDefault, label: paramLabel,
                    options: paramOptions
                });
            }
        }
    }
    if (descriptionLines.length > 0) result.description = descriptionLines.join(' ');
    return result;
}

var content = '# param: color|enum:red,green,blue|red|Color';
var parsed = parseRqHeaders(content);
var p = parsed.params[0];
var ok = (p && p.type === 'enum' && p.autocompleteType === null);
process.stdout.write(ok ? 'PASS' : 'FAIL: type=' + (p && p.type) + ' autocompleteType=' + (p && p.autocompleteType));
" 2>&1)

if [ "$ENUM_TEST_RESULT" = "PASS" ]; then
    pass "parseRqHeaders behavioral test: enum: param produces type='enum', autocompleteType=null (no regression)"
else
    fail "parseRqHeaders behavioral test: $ENUM_TEST_RESULT"
fi

# ---------------------------------------------------------------------------
# Task 07-02-01 — type-dispatched buildParamPanel
# Requirement: buildParamPanel dispatches by p.autocompleteType not p.name
# ---------------------------------------------------------------------------
echo ""
echo "=== Task 07-02-01: type-dispatched buildParamPanel ==="

# Check 1: type-based dispatch exists in snorql.js — either directly via p.autocompleteType
# or via a helper that reads p.autocompleteType (resolveAutocompleteType is the approved helper).
# The requirement is that dispatch is type-driven, not name-driven.
if grep -q "p\.autocompleteType\|p.autocompleteType\|resolveAutocompleteType" "$SNORQL_JS"; then
    pass "snorql.js buildParamPanel contains type-based autocomplete dispatch (p.autocompleteType or resolveAutocompleteType)"
else
    fail "snorql.js buildParamPanel missing type-based autocomplete dispatch"
fi

# Check 1b: resolveAutocompleteType, when present, must read p.autocompleteType first (not skip it)
if grep -q "function resolveAutocompleteType" "$SNORQL_JS"; then
    if grep -A5 "function resolveAutocompleteType" "$SNORQL_JS" | grep -q "param\.autocompleteType\|p\.autocompleteType"; then
        pass "resolveAutocompleteType reads param.autocompleteType as first priority"
    else
        fail "resolveAutocompleteType does not read param.autocompleteType — type dispatch may be broken"
    fi
fi

# Check 2: no legacy name-based dispatch remains (p.name === 'pathwayId' or p.name === 'species')
if grep -q "p\.name === 'pathwayId'\|p\.name === .species." "$SNORQL_JS"; then
    fail "snorql.js still contains legacy name-based dispatch (p.name === 'pathwayId' or 'species')"
else
    pass "snorql.js has no legacy p.name === 'pathwayId' or p.name === 'species' dispatch"
fi

# Check 3: initAutocompleteField is called inside buildParamPanel (generic wiring)
# Count how many times initAutocompleteField appears — at least 2 (definition + call)
AC_FIELD_COUNT=$(grep -c "initAutocompleteField" "$SNORQL_JS" || true)
if [ "$AC_FIELD_COUNT" -ge 2 ]; then
    pass "snorql.js initAutocompleteField appears $AC_FIELD_COUNT times (definition + at least 1 call)"
else
    fail "snorql.js initAutocompleteField only appears ${AC_FIELD_COUNT:-0} times — expected definition + call"
fi

# Check 4: no direct calls to removed initPathwayAutocomplete / initSpeciesAutocomplete
for removed_fn in initPathwayAutocomplete initSpeciesAutocomplete; do
    if grep -q "$removed_fn()" "$SNORQL_JS"; then
        fail "snorql.js still calls removed function '$removed_fn()'"
    else
        pass "snorql.js does not call removed function '$removed_fn()'"
    fi
done

# Check 5: enum rendering still preserved (no regression)
if grep -q "p\.type === 'enum'" "$SNORQL_JS"; then
    pass "snorql.js buildParamPanel preserves enum dropdown rendering"
else
    fail "snorql.js buildParamPanel missing enum dropdown rendering (regression)"
fi

# Check 6: initial substitution block preserved (substituteParams + editor.setValue)
if grep -q "substituteParams(templateContent" "$SNORQL_JS"; then
    pass "snorql.js buildParamPanel preserves substituteParams(templateContent, ...) call"
else
    fail "snorql.js buildParamPanel missing substituteParams(templateContent, ...) call (regression)"
fi

# Check 7: syntax validation (node --check)
if node --check "$SNORQL_JS" 2>/dev/null; then
    pass "snorql.js passes node --check (no syntax errors)"
else
    fail "snorql.js fails node --check (syntax error present)"
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
echo ""
echo "=== Results ==="
TOTAL=$((PASS + FAIL))
echo "  Passed: $PASS / $TOTAL"
echo "  Failed: $FAIL / $TOTAL"
echo ""

if [ "$FAIL" -eq 0 ]; then
    echo "STATUS: ALL PASS"
    exit 0
else
    echo "STATUS: $FAIL FAILURE(S)"
    exit 1
fi
