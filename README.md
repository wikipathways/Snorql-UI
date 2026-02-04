[![CI](https://github.com/wikipathways/Snorql-UI/actions/workflows/ci.yml/badge.svg)](https://github.com/wikipathways/Snorql-UI/actions/workflows/ci.yml)
[![Docker Build](https://github.com/wikipathways/Snorql-UI/actions/workflows/docker.yml/badge.svg)](https://github.com/wikipathways/Snorql-UI/actions/workflows/docker.yml)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

## Snorql-UI - A SPARQL Explorer

Simple SPARQL query interface based on the original idea of [kurtjx/SNORQL](https://github.com/kurtjx/SNORQL) and adapted from the fork [eccenca/SNORQL](https://github.com/eccenca/SNORQL) 

The purpose of this project is to develop a fully new UI implementation for Snorql that uses the latest web standards for HTML5, CSS3 and JQuery, and add new productivity features to facilitate query retrieval and sharing.

Live Demo of Snorql-UI:  [Demo 1](https://wikipathways.github.io/Snorql-UI) 	 [Demo 2](https://ammar257ammar.github.io/Snorql-UI)



## Features

1.  Modern web UI built with [HTML5](https://en.wikipedia.org/wiki/HTML5), [Bootstrap](https://getbootstrap.com/docs/3.3/getting-started/) and [JQuery](https://jquery.com/).
2.  Responsive design with wonderful look on mobiles and tablets.
3.  Text editor [CodeMirror](https://codemirror.net/) for the SPARQL query with awesome features like SPARQL syntax highlighter, line numbering and bracket matching.
4.  SPARQL examples panel that can fetch SPARQL queries (.rq extension) from any GitHub repository on the fly and execute them against the SPARQL endpoint of your choice.
5.  Export query results into multiple file formats.
6.  Generate short URLs for your queries for easy sharing.
7.  No need for any backend programming language!! it is totally a front end application.



## GitHub Examples URL

- If you have the SPARQL queries directly inside the repo, then use the full the URL of the repo like the following:

  [https://github.com/wikipathways/SPARQLQueries](https://github.com/wikipathways/SPARQLQueries)


- But in case the SPARQL queries are inside a folder in the repository, then you need to provide a GitHub API URL for that folder and that is constructed as follows:

  If the URL of the folder of the queries is this (for example):

  https://github.com/egonw/SARS-CoV-2-Queries/tree/main/sparql

  Then the URL template you should use is:

  https://api.github.com/repos/{OWNER_USER}/{REPOSITORY_NAME}/contents/{FOLDER_PATH}

  And the final URL becomes like this:

  https://api.github.com/repos/egonw/SARS-CoV-2-Queries/contents/sparql


## SPARQL Examples Repository Structure

The examples panel fetches `.rq` files from GitHub repositories. Here's how to structure your repository:

### File Conventions
- Use `.rq` extension for SPARQL query files
- Use descriptive filenames (spaces allowed): `Get all metabolites.rq`
- First line comment becomes the query description in the panel

### Folder Organization

Organize queries into folders by category:

```
sparql-queries/
├── Basic/
│   ├── List all classes.rq
│   └── Count triples.rq
├── Metabolites/
│   ├── Get all metabolites.rq
│   └── Metabolites by pathway.rq
└── Advanced/
    └── Federated query example.rq
```

### Tree View Behavior
- Folders become expandable nodes in the examples panel
- Files appear as clickable query items
- Nested folders are fully supported
- Alphabetical ordering within each level

### Example Repositories
- WikiPathways: https://github.com/wikipathways/SPARQLQueries
- SARS-CoV-2: https://api.github.com/repos/egonw/SARS-CoV-2-Queries/contents/sparql


## Get a URL for a query with JavaScript

- if you want to get a URL for your query (automatically generated for example) without using the permanent link, then you can use the following JavaScript code:

```javascript
// the SPARQL endpoint URL followed by the query variable 'q'
let endpoint = "https://sparql.wikipathways.org/?q=";

// The SPARQL query itself
let sparql = `SELECT DISTINCT ?dataset (str(?titleLit) as ?title) ?date ?license 
WHERE {
   ?dataset a void:Linkset ;
   dcterms:title ?titleLit .
   OPTIONAL {
	 ?dataset dcterms:license ?license ;
	   pav:createdOn ?date .
   }
}`;
			
// create the URL from the endpoint URL and the URI-encoded query string
let encodedQueryUrl = endpoint + encodeURI(sparql);

// now, encodedQueryUrl can be used for your own purpose
```


## Quick Start

### Option 1: Static Files (No Docker)

1. Clone the repository
2. Edit `assets/js/snorql.js` and set:
   - `_endpoint` - Your SPARQL endpoint URL
   - `_examples_repo` - GitHub repo with .rq example files
3. Open `index.html` in a browser or serve via any HTTP server

### Option 2: Docker Compose

1. Copy the example configuration files:
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp .env.example .env
   ```
2. Edit `.env` with your settings (or edit `docker-compose.yml` directly)
3. Start the services:
   ```bash
   docker compose up -d
   ```
4. Access the UI at http://localhost:8088


## Configuration

### Using .env Files

The easiest way to configure Snorql-UI is with a `.env` file. This file serves as the **single source of truth** for both Docker Compose and shell scripts.

```bash
# Copy the template
cp .env.example .env

# Edit with your settings
nano .env

# Verify configuration
docker compose config

# Start services
docker compose up -d
```

The `.env` file is gitignored, so your local configuration won't be committed.

**How configuration flows:**

```
.env (single source of truth)
    │
    ├── Docker Compose (reads .env automatically)
    │       └── Container environment variables
    │               └── script.sh (configures Snorql-UI at startup)
    │
    └── Shell scripts (via scripts/config.sh)
            └── enable-cors.sh, load-rdf-example.sh, etc.
```

Shell scripts in `scripts/` source `config.sh`, which automatically loads your `.env` file. This means you only need to edit `.env` once - both Docker Compose and shell scripts will use the same values.

### Environment Variables

All variables can be set in `.env`, exported in your shell, or hardcoded in `docker-compose.yml`.

**Snorql-UI Settings:**

| Variable | Default | Description |
|----------|---------|-------------|
| `SNORQL_CONTAINER` | `my-snorql` | Docker container name |
| `SNORQL_PORT` | `8088` | HTTP port for web interface |
| `SNORQL_ENDPOINT` | `http://localhost:8890/sparql` | SPARQL endpoint URL (as seen from browser) |
| `SNORQL_EXAMPLES_REPO` | - | GitHub repo with .rq example files |
| `SNORQL_TITLE` | `My SPARQL Explorer` | Browser tab title |
| `DEFAULT_GRAPH` | (empty) | Default RDF graph |

**Virtuoso Settings:**

| Variable | Default | Description |
|----------|---------|-------------|
| `VIRTUOSO_CONTAINER` | `my-virtuoso` | Docker container name |
| `VIRTUOSO_HOST` | `localhost` | Hostname for external connections |
| `VIRTUOSO_HTTP_PORT` | `8890` | HTTP/SPARQL endpoint port |
| `VIRTUOSO_ISQL_PORT` | `1111` | ISQL port for data loading |
| `VIRTUOSO_USER` | `dba` | Database admin username |
| `VIRTUOSO_PASSWORD` | `dba123` | Database admin password |
| `SPARQL_UPDATE` | `false` | Allow SPARQL UPDATE queries |
| `CORS_ORIGINS` | `*` | CORS allowed origins |

### URL Parameters

You can override the SPARQL endpoint via URL parameter:
```
http://localhost:8088/?endpoint=http://other-endpoint/sparql
```

This is useful for linking to the UI with a specific endpoint pre-configured.


## Docker Compose

### Commands

```bash
# Start services in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View logs for specific service
docker-compose logs -f snorql

# Rebuild after code changes
docker-compose up -d --build
```

### Ports

| Port | Service |
|------|---------|
| 8088 | Snorql-UI web interface |
| 8890 | Virtuoso HTTP/SPARQL endpoint |
| 1111 | Virtuoso ISQL (for data loading) |

### Data Persistence

To persist Virtuoso data between container restarts, uncomment the volumes section in `docker-compose.yml`:

```yaml
virtuoso:
  volumes:
    - ./virtuoso-data:/database
```

Create the directory first: `mkdir virtuoso-data`


## Customization

| Change | File | What to Modify |
|--------|------|----------------|
| SPARQL endpoint | `assets/js/snorql.js` | `_endpoint` variable |
| Examples repo | `assets/js/snorql.js` | `_examples_repo` variable |
| Page title | `index.html` | `<title>` tag |
| Logo | `assets/images/` | Replace logo files |
| Footer | `index.html` | Edit footer section |
| Namespaces | `assets/js/namespaces.js` | `snorql_namespacePrefixes` object |
| Bitly token | `assets/js/script.js` | `accessToken` (line 180) |

### Branding

To customize branding:
1. Replace logo images in `assets/images/`
2. Edit the footer section in `index.html`
3. Update the page title in `index.html`

### Logo Replacement

The default logo is WikiPathways-branded. For your own deployment:

1. Create a logo image (recommended: 200x50 pixels, PNG format)
2. Replace `assets/images/wikipathways-snorql-logo.png` with your logo
3. Or update `index.html` line 40 to reference a different logo file

For Docker deployments, mount your custom logo:
```yaml
volumes:
  - ./my-logo.png:/usr/share/nginx/html/assets/images/wikipathways-snorql-logo.png
```


## Loading RDF Data

If using the included Virtuoso container, you can load RDF data using the example script:

```bash
# See scripts/load-rdf-example.sh for detailed instructions
./scripts/load-rdf-example.sh
```

Basic Virtuoso data loading via isql:
```bash
# Connect to Virtuoso container
docker exec -it my-virtuoso isql 1111 dba dba123

# Load data from URL
SPARQL LOAD <http://example.org/data.ttl> INTO GRAPH <http://example.org/graph>;
checkpoint;
quit;
```


## Enabling CORS on Virtuoso

For browser-based SPARQL queries to work, CORS (Cross-Origin Resource Sharing) must be enabled on Virtuoso's `/sparql` endpoint. Without CORS, browsers block requests from web pages (e.g., Snorql-UI at `localhost:8088`) to different origins (e.g., Virtuoso at `localhost:8890`).

### Quick Setup

After starting Virtuoso, run the CORS configuration script:

```bash
./scripts/enable-cors.sh
```

### Production Setup

For production, restrict CORS to your specific domain:

```bash
CORS_ORIGINS="http://yourdomain.com" ./scripts/enable-cors.sh
```

### Custom Configuration

The script supports these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `VIRTUOSO_CONTAINER` | `my-virtuoso` | Docker container name |
| `VIRTUOSO_ISQL_PORT` | `1111` | ISQL connection port |
| `VIRTUOSO_USER` | `dba` | Database username |
| `VIRTUOSO_PASSWORD` | `dba123` | Database password |
| `CORS_ORIGINS` | `*` | Allowed origins (`*` = all) |

For persistent configuration, set variables in your `.env` file. Shell scripts automatically read this file via `scripts/config.sh`.

### Verification

Test CORS from your browser console:

```javascript
fetch('http://localhost:8890/sparql?query=SELECT+*+WHERE+{?s+?p+?o}+LIMIT+1')
  .then(r => r.text())
  .then(console.log)
```

If CORS is working, you'll see SPARQL results. If not, you'll see a CORS error.


## WikiPathways Production Setup

The repository includes production configuration files used by WikiPathways. These serve as both a reference implementation and operational documentation.

### Dual-Instance Architecture

WikiPathways uses two instances (EP and EP2) for zero-downtime monthly data updates:

| Instance | Virtuoso HTTP | Virtuoso ISQL | Snorql HTTP | Snorql HTTPS |
|----------|---------------|---------------|-------------|--------------|
| EP       | 8895          | 1115          | 8085        | 449          |
| EP2      | 8891          | 1111          | 8084        | 446          |

- **Odd months** (Jan, Mar, May...): EP is live, data loads into EP2
- **Even months** (Feb, Apr, Jun...): EP2 is live, data loads into EP
- nginx reverse proxy routes traffic to the live instance

### Configuration Files

| File | Purpose |
|------|---------|
| `docker-compose.wikipathways.yml` | EP instance configuration |
| `docker-compose.wikipathways-ep2.yml` | EP2 instance configuration |
| `scripts/wikipathways-loader.sh` | Automated monthly data loader |

### Monthly Update Workflow

```bash
# 1. Run the loader (auto-detects which instance is offline)
./scripts/wikipathways-loader.sh

# 2. Validate with GitHub Actions (run your test suite)

# 3. Switch nginx to the newly-loaded instance
sudo nano /etc/nginx/sites-enabled/wikipathways
sudo service nginx restart
```

### Customization

Before using these files, update:
- Volume paths in docker-compose files (default: `/home/MarvinMartens/WikiPathways-EP/`)
- `DBA_PASSWORD` from default `dba` to a secure password
- `BASE_DIR_EP` and `BASE_DIR_EP2` in the loader script


## Adopting for Your Own SPARQL Endpoint

This section guides you through setting up Snorql-UI with your own RDF data and SPARQL endpoint.

### Folder Structure

```
your-project/
├── db/                          # Virtuoso database files
│   └── data/
│       ├── load.sh              # Your customized loader script
│       └── YourData.ttl         # Your RDF data file(s)
├── scripts/
│   ├── load.sh.template         # Template (don't modify)
│   └── your-loader.sh           # Optional: automated data fetching
├── docker-compose.yml           # Your configuration
├── assets/                      # Snorql UI assets
├── index.html                   # Snorql UI entry point
└── ...
```

### Quick Start

1. **Copy the example configuration files:**
   ```bash
   cp docker-compose.example.yml docker-compose.yml
   cp .env.example .env
   ```

2. **Create data directory and loader script:**
   ```bash
   mkdir -p db/data
   cp scripts/load.sh.template db/data/load.sh
   chmod +x db/data/load.sh
   ```

3. **Customize the loader script (`db/data/load.sh`):**
   - Set `GRAPH_URI` to your named graph (e.g., `http://yourdomain.org/data/`)
   - Set `DATA_FILE` to your RDF file name
   - Add your domain-specific namespace prefixes

4. **Place your RDF data files in `db/data/`:**
   - Supported formats: Turtle (`.ttl`), RDF/XML (`.rdf`), N-Triples (`.nt`)

5. **Configure `.env` with your settings:**
   - `SNORQL_ENDPOINT` - Your SPARQL endpoint URL
   - `SNORQL_EXAMPLES_REPO` - Your GitHub queries repository
   - `SNORQL_TITLE` - Browser tab title
   - `VIRTUOSO_PASSWORD` - Secure password for production

6. **Start the services:**
   ```bash
   docker compose up -d
   ```

7. **Load your data into Virtuoso:**
   ```bash
   docker exec -it my-virtuoso /bin/bash
   cd /database/data
   ./load.sh load.log dba123
   exit
   ```

8. **Access the UI at http://localhost:8088**

### Customization Checklist

- [ ] **Graph URI** in `db/data/load.sh` - Your named graph identifier
- [ ] **Namespace prefixes** in `db/data/load.sh` - Add your domain-specific prefixes
- [ ] **SNORQL_ENDPOINT** in `.env` - Your SPARQL endpoint URL
- [ ] **SNORQL_EXAMPLES_REPO** in `.env` - Your GitHub queries repository
- [ ] **SNORQL_TITLE** in `.env` - Browser tab title
- [ ] **VIRTUOSO_PASSWORD** in `.env` - Secure password for production
- [ ] **Optional:** `assets/js/namespaces.js` - For UI prefix expansion in results

### Example: Minimal Custom Setup

```bash
# 1. Clone repository
git clone https://github.com/wikipathways/Snorql-UI.git my-sparql-ui
cd my-sparql-ui

# 2. Set up configuration
cp docker-compose.example.yml docker-compose.yml
cp .env.example .env
mkdir -p db/data
cp scripts/load.sh.template db/data/load.sh

# 3. Edit db/data/load.sh
#    Change: GRAPH_URI="http://myproject.org/data/"
#    Change: DATA_FILE="mydata.ttl"
#    Add your namespace prefixes

# 4. Copy your data file
cp /path/to/mydata.ttl db/data/

# 5. Edit .env
#    Change: SNORQL_ENDPOINT=http://localhost:8890/sparql
#    Change: SNORQL_EXAMPLES_REPO=https://github.com/myorg/sparql-queries
#    Change: SNORQL_TITLE=My SPARQL Explorer

# 6. Start and load
docker compose up -d
docker exec -it my-virtuoso /bin/bash -c "cd /database/data && ./load.sh load.log dba123"

# 7. Access at http://localhost:8088
```

### Automated Data Loading with Quality Control

For automated/scheduled data updates, use `scripts/data-loader.sh` as a template. This script includes:

- **Download verification** - Checks each file download succeeds
- **Turtle validation** - Uses `rapper` to validate RDF syntax before loading
- **Load verification** - Confirms all files reached `ll_state = 2` (success)
- **Dry-run mode** - Validate without loading (`--dry-run`)

```bash
# Configure for your data source
export DATA_SOURCE="http://your-data-server.org/rdf"
export DATA_FILES="mydata.ttl vocabulary.ttl"
export VIRTUOSO_CONTAINER="my-virtuoso"
export VIRTUOSO_PASSWORD="dba123"
export GRAPH_URI="http://example.org/graph/"

# Run the loader
./scripts/data-loader.sh

# Or validate only (dry run)
./scripts/data-loader.sh --dry-run
```

Edit the script's CONFIGURATION section to set defaults for your deployment, then schedule with cron for automatic updates.

### Tips

- **Multiple data files:** Add multiple `ld_dir()` commands in `load.sh` or use wildcards
- **Turtle validation:** Install `raptor2-utils` (`sudo apt-get install raptor2-utils`) for syntax validation
- **Federated queries:** The template includes grants for SPARQL federation (SERVICE keyword)
- **Namespace prefixes:** Also update `assets/js/namespaces.js` so URIs display as compact QNames in the UI
