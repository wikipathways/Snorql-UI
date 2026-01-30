#!/bin/bash
#
# Generic RDF Data Loader for Snorql-UI + Virtuoso
#
# This script downloads RDF data, validates it, and loads it into Virtuoso.
# Adapt this template for your own automated data loading workflow.
#
# Usage: data-loader.sh [options]
#
# Options:
#   -h, --help     Show this help message
#   -d, --dry-run  Download and validate only, don't load into Virtuoso
#
# Prerequisites:
#   - Docker containers running (Virtuoso + Snorql)
#   - wget installed
#   - rapper (raptor2-utils) for Turtle validation (optional but recommended)
#     Install with: sudo apt-get install raptor2-utils
#
# Configuration:
#   Edit the CONFIGURATION section below, or set environment variables:
#     DATA_SOURCE, VIRTUOSO_CONTAINER, VIRTUOSO_PASSWORD, GRAPH_URI
#
# Example:
#   # Using defaults from script
#   ./scripts/data-loader.sh
#
#   # Using environment variables
#   DATA_SOURCE="http://example.org/data" VIRTUOSO_CONTAINER="my-virtuoso" ./scripts/data-loader.sh
#
#   # Dry run (validate only)
#   ./scripts/data-loader.sh --dry-run

set -e  # Exit on error

# =============================================================================
# CONFIGURATION - Customize these for your deployment
# =============================================================================

# Data source URL - where to download RDF files from
# Can be a directory listing or direct file URLs
DATA_SOURCE="${DATA_SOURCE:-http://example.org/rdf-data}"

# Files to download (space-separated list)
# These will be downloaded from DATA_SOURCE
DATA_FILES="${DATA_FILES:-mydata.ttl}"

# Additional vocabulary/ontology files (optional, space-separated)
# Set to empty string if not needed
VOCAB_FILES="${VOCAB_FILES:-}"

# Virtuoso container name
VIRTUOSO_CONTAINER="${VIRTUOSO_CONTAINER:-my-virtuoso}"

# Virtuoso password
VIRTUOSO_PASSWORD="${VIRTUOSO_PASSWORD:-dba123}"

# Named graph URI for your data
GRAPH_URI="${GRAPH_URI:-http://example.org/graph/}"

# Working directory for downloads (relative to script location or absolute)
WORK_DIR="${WORK_DIR:-./db/data}"

# =============================================================================
# SCRIPT OPTIONS
# =============================================================================

DRY_RUN=false

show_help() {
    head -35 "$0" | tail -32
    exit 0
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -h|--help)
            show_help
            ;;
        -d|--dry-run)
            DRY_RUN=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# =============================================================================
# FUNCTIONS
# =============================================================================

log_info() {
    echo "[INFO] $1"
}

log_warn() {
    echo "[WARN] $1"
}

log_error() {
    echo "[ERROR] $1" >&2
}

# Download a single file with error handling
download_file() {
    local url=$1
    local output=$2

    log_info "Downloading: $url"
    if ! wget -q -O "$output" "$url"; then
        log_error "Failed to download: $url"
        return 1
    fi
    log_info "  -> Saved to: $output"
    return 0
}

# Download all configured data files
download_files() {
    log_info "Starting downloads from: $DATA_SOURCE"
    echo ""

    local failed=0

    # Download main data files
    for file in $DATA_FILES; do
        if ! download_file "${DATA_SOURCE}/${file}" "$file"; then
            failed=1
        fi
    done

    # Download vocabulary files if configured
    if [ -n "$VOCAB_FILES" ]; then
        log_info "Downloading vocabulary files..."
        for file in $VOCAB_FILES; do
            if ! download_file "${DATA_SOURCE}/${file}" "$file"; then
                log_warn "Vocabulary file not available: $file (continuing...)"
            fi
        done
    fi

    if [ $failed -eq 1 ]; then
        log_error "Some required files failed to download"
        return 1
    fi

    log_info "All files downloaded successfully"
    return 0
}

# Validate Turtle syntax using rapper
validate_turtle() {
    log_info "Validating Turtle syntax..."

    # Check if rapper is installed
    if ! command -v rapper &> /dev/null; then
        log_warn "rapper not found - skipping Turtle validation"
        log_warn "Install with: sudo apt-get install raptor2-utils"
        return 0
    fi

    local failed=false

    # Validate all .ttl files in current directory
    for ttl_file in *.ttl; do
        [ -e "$ttl_file" ] || continue  # Skip if no .ttl files

        log_info "  Validating: $ttl_file"
        if ! rapper -i turtle "$ttl_file" -c 2>/dev/null; then
            log_error "  FAILED: $ttl_file"
            failed=true
        fi
    done

    if [ "$failed" = true ]; then
        log_error "Turtle validation failed!"
        return 1
    fi

    log_info "All Turtle files validated successfully"
    return 0
}

# Concatenate multiple TTL files into one (optional)
concatenate_files() {
    local output_file=$1
    shift
    local input_files="$@"

    log_info "Concatenating files into: $output_file"

    # Remove existing output file
    rm -f "$output_file"

    # Concatenate all input files
    for file in $input_files; do
        if [ -f "$file" ]; then
            cat "$file" >> "$output_file"
            echo "" >> "$output_file"  # Add newline between files
        fi
    done

    log_info "Concatenation complete"
    return 0
}

# Load data into Virtuoso
load_into_virtuoso() {
    log_info "Loading data into Virtuoso container: $VIRTUOSO_CONTAINER"

    # Check if container is running
    if ! docker ps --format '{{.Names}}' | grep -q "^${VIRTUOSO_CONTAINER}$"; then
        log_error "Virtuoso container '$VIRTUOSO_CONTAINER' is not running"
        return 1
    fi

    # Execute the loader script inside the container
    if ! docker exec -i "$VIRTUOSO_CONTAINER" bash -c \
        "/opt/virtuoso-opensource/database/data/load.sh /opt/virtuoso-opensource/database/data/load.log $VIRTUOSO_PASSWORD"; then
        log_error "Virtuoso loading failed!"
        return 1
    fi

    log_info "Data loaded into Virtuoso"
    return 0
}

# Verify load status from Virtuoso log
verify_load_status() {
    local log_file="$WORK_DIR/load.log"

    log_info "Verifying load status..."

    if [ ! -f "$log_file" ]; then
        log_warn "Log file not found: $log_file"
        return 0
    fi

    # Check if all data files show ll_state = 2 (successfully loaded)
    # ll_state meanings: 0=pending, 1=loading, 2=complete, 3=error
    if grep -q "^data/" "$log_file"; then
        if grep "^data/" "$log_file" | grep -qv " 2 "; then
            log_error "Some files have ll_state != 2 (not fully loaded)"
            log_error "Check $log_file for details"
            grep "^data/" "$log_file"
            return 1
        fi
        log_info "All files loaded successfully (ll_state = 2)"
    else
        log_warn "Could not verify load status from log file"
    fi

    return 0
}

# Clean up old files before new download
cleanup_old_files() {
    log_info "Cleaning up old files..."

    # Remove old data files but preserve load.sh
    rm -f *.ttl *.rdf *.nt *.zip 2>/dev/null || true

    log_info "Cleanup complete"
}

# =============================================================================
# MAIN WORKFLOW
# =============================================================================

main() {
    echo "========================================="
    echo "RDF Data Loader"
    echo "Started: $(date)"
    echo "========================================="
    echo ""

    # Show configuration
    log_info "Configuration:"
    log_info "  Data source: $DATA_SOURCE"
    log_info "  Data files: $DATA_FILES"
    log_info "  Graph URI: $GRAPH_URI"
    log_info "  Work directory: $WORK_DIR"
    log_info "  Virtuoso container: $VIRTUOSO_CONTAINER"
    [ "$DRY_RUN" = true ] && log_info "  Mode: DRY RUN (validate only)"
    echo ""

    # Navigate to work directory
    if [ ! -d "$WORK_DIR" ]; then
        log_error "Work directory does not exist: $WORK_DIR"
        log_info "Create it with: mkdir -p $WORK_DIR"
        exit 1
    fi

    cd "$WORK_DIR" || {
        log_error "Cannot access work directory: $WORK_DIR"
        exit 1
    }

    # Step 1: Cleanup
    cleanup_old_files
    echo ""

    # Step 2: Download files
    if ! download_files; then
        log_error "Download failed!"
        exit 1
    fi
    echo ""

    # Step 3: Validate Turtle syntax
    if ! validate_turtle; then
        log_error "Validation failed!"
        exit 1
    fi
    echo ""

    # Step 4: Load into Virtuoso (skip if dry run)
    if [ "$DRY_RUN" = true ]; then
        log_info "Dry run - skipping Virtuoso load"
    else
        if ! load_into_virtuoso; then
            log_error "Loading failed!"
            exit 1
        fi
        echo ""

        # Step 5: Verify load status
        if ! verify_load_status; then
            log_error "Load verification failed!"
            exit 1
        fi
    fi
    echo ""

    # Success
    echo "========================================="
    echo "RDF Data Loading COMPLETED"
    echo "Finished: $(date)"
    echo "========================================="
    echo ""

    if [ "$DRY_RUN" = true ]; then
        log_info "Dry run completed - data validated but not loaded"
    else
        log_info "Data loaded successfully into graph: $GRAPH_URI"
        log_info ""
        log_info "Test your endpoint:"
        log_info "  curl 'http://localhost:8890/sparql?query=SELECT+*+WHERE+{?s+?p+?o}+LIMIT+10'"
    fi

    exit 0
}

# Run main workflow
main
