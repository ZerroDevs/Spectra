/**
 * ============================================================================
 * Spectra SEO & Sitemap Automation Tool
 * ----------------------------------------------------------------------------
 * Automatically scans HTML documents in the project root, parses metadata,
 * calculates change frequencies & priorities, and generates clean, production-ready
 * sitemap.xml and robots.txt files.
 *
 * Usage:
 *   node scripts/generate-seo.js
 *   node scripts/generate-seo.js --base-url https://yourdomain.com
 *   npm run seo
 * ============================================================================
 */

const fs = require('fs');
const path = require('path');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const SITEMAP_PATH = path.join(ROOT_DIR, 'sitemap.xml');
const ROBOTS_PATH = path.join(ROOT_DIR, 'robots.txt');

// Parse CLI flags for custom base URL
function getBaseUrl() {
    const args = process.argv.slice(2);
    const flagIdx = args.indexOf('--base-url');
    if (flagIdx !== -1 && args[flagIdx + 1]) {
        return args[flagIdx + 1].replace(/\/+$/, '');
    }
    return process.env.BASE_URL || 'https://zerrodevs.github.io/Spectra';
}

const BASE_URL = getBaseUrl();

// Excluded files that should not be indexed in search engines
const EXCLUDED_FILES = new Set([
    '404.html',
    'dashboard.html' // Instant redirect wrapper for index.html
]);

// Custom page priority & change frequency definitions
const PAGE_CONFIG = {
    'index.html': { priority: '1.0', changefreq: 'daily' },
    'workspace.html': { priority: '0.9', changefreq: 'weekly' },
    'live.html': { priority: '0.8', changefreq: 'weekly' },
    'timeline.html': { priority: '0.8', changefreq: 'weekly' },
    'matrix.html': { priority: '0.8', changefreq: 'weekly' },
    'reports.html': { priority: '0.8', changefreq: 'weekly' },
    'vault.html': { priority: '0.8', changefreq: 'weekly' },
    'converter.html': { priority: '0.8', changefreq: 'weekly' },
    'audit.html': { priority: '0.8', changefreq: 'weekly' },
    'diff.html': { priority: '0.8', changefreq: 'weekly' },
    'graph.html': { priority: '0.8', changefreq: 'weekly' },
    'rules.html': { priority: '0.8', changefreq: 'weekly' },
    'analytics.html': { priority: '0.8', changefreq: 'weekly' },
    'about.html': { priority: '0.7', changefreq: 'monthly' }
};

// Default fallback for any newly added HTML page
const DEFAULT_PAGE_CONFIG = {
    priority: '0.6',
    changefreq: 'weekly'
};

function escapeXml(unsafe) {
    return unsafe.replace(/[<>&'"]/g, (c) => {
        switch (c) {
            case '<': return '&lt;';
            case '>': return '&gt;';
            case '&': return '&amp;';
            case '\'': return '&apos;';
            case '"': return '&quot;';
        }
    });
}

function extractMetadata(htmlContent) {
    let title = '';
    let description = '';

    const titleMatch = htmlContent.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (titleMatch) {
        title = titleMatch[1].trim();
    }

    const descMatch = htmlContent.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
                      htmlContent.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
    if (descMatch) {
        description = descMatch[1].trim();
    }

    return { title, description };
}

function scanHtmlFiles() {
    const files = fs.readdirSync(ROOT_DIR);
    const htmlFiles = files.filter(f => f.endsWith('.html'));
    const scanned = [];

    for (const file of htmlFiles) {
        const filePath = path.join(ROOT_DIR, file);
        const stats = fs.statSync(filePath);
        const content = fs.readFileSync(filePath, 'utf8');
        const { title, description } = extractMetadata(content);

        const isExcluded = EXCLUDED_FILES.has(file);
        const config = PAGE_CONFIG[file] || DEFAULT_PAGE_CONFIG;
        const lastmod = stats.mtime.toISOString().split('T')[0];

        scanned.push({
            filename: file,
            title,
            description,
            lastmod,
            priority: config.priority,
            changefreq: config.changefreq,
            isExcluded,
            sizeBytes: stats.size
        });
    }

    // Sort index first, then workspace, then alphabetically
    scanned.sort((a, b) => {
        if (a.filename === 'index.html') return -1;
        if (b.filename === 'index.html') return 1;
        if (a.filename === 'workspace.html') return -1;
        if (b.filename === 'workspace.html') return 1;
        return a.filename.localeCompare(b.filename);
    });

    return scanned;
}

function generateSitemapXml(pages) {
    const validPages = pages.filter(p => !p.isExcluded);

    const urlsXml = validPages.map(page => {
        const pageUrl = page.filename === 'index.html' ? `${BASE_URL}/` : `${BASE_URL}/${page.filename}`;
        return `    <url>
        <loc>${escapeXml(pageUrl)}</loc>
        <lastmod>${page.lastmod}</lastmod>
        <changefreq>${page.changefreq}</changefreq>
        <priority>${page.priority}</priority>
    </url>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlsXml}
</urlset>
`;
}

function generateRobotsTxt() {
    return `# ==============================================================================
# Spectra Robots Specification
# Automatically generated via scripts/generate-seo.js
# ==============================================================================

User-agent: *
Allow: /
Disallow: /404.html
Disallow: /scratch/
Disallow: /.git/

# Canonical Sitemap
Sitemap: ${BASE_URL}/sitemap.xml
`;
}

function run() {
    console.log('====================================================');
    console.log('Spectra SEO & Sitemap Automation Suite');
    console.log(`Base URL: ${BASE_URL}`);
    console.log('====================================================\n');

    const pages = scanHtmlFiles();

    console.log(`Discovered ${pages.length} HTML files:`);
    for (const page of pages) {
        const status = page.isExcluded ? '[EXCLUDED]' : `[PRIORITY: ${page.priority}]`;
        console.log(`  - ${page.filename.padEnd(16)} ${status.padEnd(16)} ${page.title || '(No title)'}`);
    }

    const sitemapContent = generateSitemapXml(pages);
    fs.writeFileSync(SITEMAP_PATH, sitemapContent, 'utf8');
    console.log(`\n[SUCCESS] Wrote sitemap.xml -> ${SITEMAP_PATH} (${Buffer.byteLength(sitemapContent)} bytes)`);

    const robotsContent = generateRobotsTxt();
    fs.writeFileSync(ROBOTS_PATH, robotsContent, 'utf8');
    console.log(`[SUCCESS] Wrote robots.txt  -> ${ROBOTS_PATH} (${Buffer.byteLength(robotsContent)} bytes)`);

    console.log('\nSEO automation generation complete.');
}

run();
