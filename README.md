# PUDL applet packages

An applet package is a folder that any site or application built with [PUDL](https://github.com/paulmooreparks/pudl) can install by copying it into its web root. This repo holds what every package and every host share: the manifest format, the host kit, the packing tool and an example. The design it comes from is `Architecture/applet-packages-design.md` in the [parkscomputing](https://github.com/paulmooreparks/parkscomputing) repo.

## A package

```
hello/
  applet.json      what the applet is and what it needs (schema/applet.schema.json)
  hello.js         calls pudlApplets.register('hello', …)
  hello.css
  page.html        the page body: the mount and any copy around it (optional)
  actions.json     the actions the applet publishes (optional)
  actions.js       their module (optional)
  vendor/          third-party libraries it loads (optional)
```

`applet.json` is the one file a host reads. The example in `examples/hello` shows every field; the schema says what each means. The name is the folder's name, the window key and the last part of the page's address. The version is the cache stamp of the applet's files, so a host never edits a version by hand.

A collection is a repo whose packages share code. The shared scripts sit in a folder beside the packages, and a package lists the ones it uses in `bundle`, which the packing tool writes in front of the package's script, so each installed package is complete in its own folder and a host can install one without the others. `bundle` as a list is for `src`; as an object it says which of the package's scripts each list goes in front of, so an actions module can carry the same engine as the applet:

```json
"bundle": {
  "barcode-tool.js": ["../engine/barcode-engine.js", "../engine/barcode-library.js"],
  "actions.js": ["../engine/barcode-engine.js"]
}
```

A folder named in `shared` is instead copied beside the packages and loaded at run time by a relative address such as `../shared/input.js`. It lands in the host's `wwwroot/applets` under its own name, beside every other collection's, so give it a name no other collection would use.

## The host interface

An applet may use PUDL's runtime (`pudlApplets`, `pudlWindows`, the theme events) and the browser. Everything it needs from the host it reads from `window.pudlHost`, which the host builds from the kit before the applets load:

| Member | What it is |
|---|---|
| `identity(root, entries)` | the applet's first menu title, with the window's commands where it is in a window |
| `action(root, selector, label)` | a menu item that presses a button in the applet |
| `pages` | where applet pages are, such as `/page/` |
| `pudl` | where the host's PUDL release is, such as `/pudl/`, for a document of the applet's own, such as a preview frame, that loads PUDL itself |
| `snapshot` | `join(root, take)` and `leave`, state kept across a reload (optional) |
| `fs` | `readText(path)`, `writeText(path, text)` and `mkdir(path)` under `~`, `onChange(fn)`, and where the host has file dialogs, `open(options)` and `save(options)` (optional, and each member optional within it) |
| `config` | `load`, `get`, `set` and `onChange` for the applet's settings (optional) |
| `service(name)` | the address of a service the host offers under that name, ending in `/`, or `null` |
| `actions` | `run(ref, input)`: runs an action one of the host's applets publishes through the host's own broker, opening a window where the action needs one, and resolves to its output (optional) |
| `fetch(url, init)` | `fetch` as the host's own pages call its server, with whatever such a request carries (such as a token against forgery); plain same-origin `fetch` where the host asks nothing more |

`fs.open({ title, accept, start, host, check })` shows the host's own Open dialog and resolves to `{ path, name, text }` for one of the host's files, `{ name, text }` for one from the reader's computer, or `null`. `fs.save({ title, name, blob, start, host, check })` shows its Save as dialog, writes the blob, and resolves to `{ path }`, `{ download: name }` when the reader chose to download it, or `null`; it rejects with the reason a write failed. In both, `check(path)` gives the reason a file won't do, or `null`. `fs.onChange(fn)` calls `fn()` after any of the host's files changes, here or in another tab, and returns a function that stops it. `fs.find(query, limit)` resolves to the host's files whose names hold the query, as `[{ path, name, kind }]`. An applet without `open` takes a file from the reader's computer, and without `save` downloads.

A service is something on the host's server an applet may call, such as the proxy the barcode scanner looks products up through, which it asks for as `service('barcode-products')`. A host builds `service` from a map: `pudlHostKit.host({ services: { 'barcode-products': '/api/barcode-products/' } })`. An applet whose host has no such service leaves out what needs it.

A service the host lacks is missing from the object, and the applet does without it. A manifest's `needs` lists the services the applet cannot run without; `wants` lists the ones it uses when present. An action module calls `pudlActions.provide(id, handlers)`.

Nothing in a package may reach a host's own globals, a fixed `/api/` address, or a host's own events (names such as `pc:fs-change`). `tools/pack.js` refuses a package that does, checking the scripts it bundles as well as its own.

## A host

A host that is a server scans `wwwroot/applets/*/applet.json` and writes from the manifests what it would otherwise write by hand: the `define()` of each applet, its page, its place in the launch menu, its action manifests and its continuity. The parkscomputing engine does this in `Pages/Services/AppletCatalog.cs`.

A page with no server does it in the browser:

```html
<script src="/pudl/pudl-applets.js" defer></script>
<script src="/js/pudl-host-kit.js" defer></script>
<script defer>
  window.pudlHost = pudlHostKit.host({});
  pudlHostKit.install('/applets/hello/applet.json');
</script>
<div data-applet="hello"></div>
```

## Packing

```
node tools/pack.js <collection dir> [<out dir>]
```

checks each package's manifest and portability, writes the scripts each package bundles in front of the scripts they are for, and copies the packages, with any shared folders, to `dist/`. A host installs a release by copying `dist/` into `wwwroot/applets/`.

## Licence

Apache License 2.0; see `LICENSE`.
