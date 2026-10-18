#!/usr/bin/env node
/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Builds a collection's dist from its package folders, checking each:

     node tools/pack.js <collection dir> [<out dir>]

   A collection is a folder whose packages are its sub-folders that hold an
   applet.json, plus any folders those name in "shared". Each package is
   checked against the manifest's rules (schema/applet.schema.json, in plain
   code here so the tool needs nothing installed) and for portability: a
   script in it may not reach a host's own globals (window.pc…) or a fixed
   /api/ address, which is what makes a package run on any host. The
   packages and their shared folders are copied to <out dir> (dist by
   default), which a host copies into its wwwroot/applets. A single-applet
   repo is a collection of one. */
'use strict';
const fs = require('fs');
const path = require('path');

const [, , collectionArg, outArg] = process.argv;
if (!collectionArg) { console.error('usage: pack.js <collection dir> [<out dir>]'); process.exit(2); }
const collection = path.resolve(collectionArg);
const out = path.resolve(outArg || path.join(collection, 'dist'));

const NAME = /^[a-z][a-z0-9-]{0,63}$/;
const FILE = /^(?!\/)(?!.*(^|\/)\.\.(\/|$))[A-Za-z0-9._/-]+$/;
const SHAPE = /^(0?\.[0-9]+|1(\.0+)?),(0?\.[0-9]+|1(\.0+)?)$/;
const PIXELS = /^[1-9][0-9]*,[1-9][0-9]*$/;
const SERVICES = ['snapshot', 'fs', 'config'];
const SHARED = /^\.\.\/[A-Za-z0-9._-]+$/;
const BUNDLE = /^\.\.\/[A-Za-z0-9._/-]+\.js$/;
const problems = [];
const problem = (pkg, text) => problems.push(pkg + ': ' + text);

/* The manifest's rules, as the schema states them. */
function check(dir) {
    const name = path.basename(dir);
    let m;
    try { m = JSON.parse(fs.readFileSync(path.join(dir, 'applet.json'), 'utf8')); } catch (e) { problem(name, 'applet.json cannot be read: ' + e.message); return null; }
    const str = (k, required) => {
        if (m[k] === undefined) { if (required) { problem(name, k + ' is missing'); } return; }
        if (typeof m[k] !== 'string' || (required && !m[k])) { problem(name, k + ' must be text'); }
    };
    const file = (k, v) => {
        if (v === undefined) { return; }
        if (typeof v !== 'string' || !FILE.test(v)) { problem(name, k + ' must be a relative path inside the package'); return; }
        if (!fs.existsSync(path.join(dir, v))) { problem(name, k + ' names ' + v + ', which is not in the package'); }
    };
    str('name', true); str('title', true); str('version', true); str('description'); str('license');
    if (typeof m.name === 'string' && !NAME.test(m.name)) { problem(name, 'name must be lower-case letters, digits and hyphens, starting with a letter'); }
    if (m.name !== name) { problem(name, 'name must be the folder\'s name, ' + name); }
    file('src', m.src); if (m.src === undefined) { problem(name, 'src is missing'); }
    file('css', m.css); file('icon', m.icon); file('actions', m.actions);
    if (m.page !== undefined) {
        if (typeof m.page !== 'object' || m.page === null) { problem(name, 'page must be an object'); }
        else { file('page.body', m.page.body); if (m.page.fit !== undefined && !['fill', 'flow'].includes(m.page.fit)) { problem(name, 'page.fit must be fill or flow'); } }
    }
    if (m.window !== undefined) {
        const w = m.window;
        if (typeof w !== 'object' || w === null) { problem(name, 'window must be an object'); }
        else {
            if (w.shape !== undefined && !SHAPE.test(String(w.shape))) { problem(name, 'window.shape must be fractions of the desktop, such as 0.28,0.88'); }
            for (const k of ['min', 'max']) { if (w[k] !== undefined && !PIXELS.test(String(w[k]))) { problem(name, 'window.' + k + ' must be pixels, such as 420,220'); } }
        }
    }
    if (m.handles !== undefined && (typeof m.handles !== 'object' || m.handles === null)) { problem(name, 'handles must be an object'); }
    if (m.instances !== undefined && !(Number.isInteger(m.instances) && m.instances >= 1)) { problem(name, 'instances must be a whole number from 1'); }
    if (m.continuity !== undefined && typeof m.continuity !== 'boolean') { problem(name, 'continuity must be true or false'); }
    for (const k of ['needs', 'wants']) {
        if (m[k] === undefined) { continue; }
        if (!Array.isArray(m[k]) || m[k].some(s => !SERVICES.includes(s))) { problem(name, k + ' may list only ' + SERVICES.join(', ')); }
    }
    if (m.shared !== undefined) {
        if (!Array.isArray(m.shared) || m.shared.some(s => typeof s !== 'string' || !SHARED.test(s))) { problem(name, 'shared may list only sibling folders, such as ../shared'); }
        else { for (const s of m.shared) { if (!fs.existsSync(path.join(dir, s))) { problem(name, 'shared names ' + s + ', which is not beside the package'); } } }
    }
    if (m.tags !== undefined && (!Array.isArray(m.tags) || m.tags.some(t => typeof t !== 'string'))) { problem(name, 'tags must be a list of text'); }
    if (m.bundle !== undefined) {
        if (!Array.isArray(m.bundle) || m.bundle.some(s => typeof s !== 'string' || !BUNDLE.test(s))) { problem(name, 'bundle may list only scripts beside the package, such as ../shared/input.js'); }
        else { for (const s of m.bundle) { if (!fs.existsSync(path.join(dir, s))) { problem(name, 'bundle names ' + s + ', which is not beside the package'); } } }
    }
    const known = ['name', 'title', 'version', 'description', 'license', 'src', 'css', 'icon', 'page', 'window', 'handles', 'instances', 'actions', 'continuity', 'needs', 'wants', 'shared', 'bundle', 'tags'];
    for (const k of Object.keys(m)) { if (!known.includes(k)) { problem(name, k + ' is not a manifest field'); } }
    return m;
}

/* What makes a script portable: it asks pudlHost for the host's services
   and reaches no address of a particular site. */
function portable(dir, name) {
    const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? (e.name === 'vendor' ? [] : walk(path.join(d, e.name))) : e.name.endsWith('.js') ? [path.join(d, e.name)] : []);
    for (const f of walk(dir)) {
        const text = fs.readFileSync(f, 'utf8');
        const rel = path.relative(dir, f);
        let m;
        if ((m = /window\.pc[A-Z]\w*|\bpc(SiteFs|Config|Snapshot|AppletIdentity|AppletAction|Actions)\b/.exec(text))) { problem(name, rel + ' reaches a host\'s own global, ' + m[0] + '; ask pudlHost instead'); }
        if ((m = /['"`]\/api\//.exec(text))) { problem(name, rel + ' reaches a fixed /api/ address; ask pudlHost instead'); }
    }
}

function copyDir(from, to) {
    fs.mkdirSync(to, { recursive: true });
    for (const e of fs.readdirSync(from, { withFileTypes: true })) {
        const a = path.join(from, e.name), b = path.join(to, e.name);
        if (e.isDirectory()) { copyDir(a, b); } else { fs.copyFileSync(a, b); }
    }
}

const dirs = fs.existsSync(path.join(collection, 'applet.json')) ? [collection]
    : fs.readdirSync(collection, { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(collection, e.name, 'applet.json'))).map(e => path.join(collection, e.name));
if (dirs.length === 0) { console.error('no package (a folder with applet.json) under ' + collection); process.exit(2); }

const packages = [], shared = new Set();
for (const dir of dirs) {
    const m = check(dir);
    if (!m) { continue; }
    portable(dir, m.name);
    packages.push({ dir, m });
    for (const s of m.shared || []) { shared.add(path.resolve(dir, s)); }
}
if (problems.length) { problems.forEach(p => console.error(p)); process.exit(1); }

fs.rmSync(out, { recursive: true, force: true });
for (const { dir, m } of packages) {
    copyDir(dir, path.join(out, m.name));
    /* The scripts a manifest bundles go in front of its src, so the
       installed script is one file; the built manifest no longer says so. */
    if (m.bundle && m.bundle.length) {
        const parts = m.bundle.map(s => fs.readFileSync(path.join(dir, s), 'utf8')).concat(fs.readFileSync(path.join(dir, m.src), 'utf8'));
        fs.writeFileSync(path.join(out, m.name, m.src), parts.join('\n'));
        const built = Object.assign({}, m);
        delete built.bundle;
        fs.writeFileSync(path.join(out, m.name, 'applet.json'), JSON.stringify(built, null, 2) + '\n');
    }
}
for (const s of shared) { copyDir(s, path.join(out, path.basename(s))); }
console.log('packed ' + packages.map(p => p.m.name + ' ' + p.m.version).join(', ') + (shared.size ? ' with ' + [...shared].map(s => path.basename(s)).join(', ') : '') + ' into ' + out);
