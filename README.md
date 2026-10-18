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

A collection is a repo whose packages share code. The shared folder sits beside the packages and each package that uses it says so in `shared`, and the packing tool copies it alongside them, so an applet loads it with a relative address such as `../shared/input.js`.

## The host interface

An applet may use PUDL's runtime (`pudlApplets`, `pudlWindows`, the theme events) and the browser. Everything it needs from the host it reads from `window.pudlHost`, which the host builds from the kit before the applets load:

| Member | What it is |
|---|---|
| `identity(root, entries)` | the applet's first menu title, with the window's commands where it is in a window |
| `action(root, selector, label)` | a menu item that presses a button in the applet |
| `pages` | where applet pages are, such as `/page/` |
| `snapshot` | `join(root, take)` and `leave`, state kept across a reload (optional) |
| `fs` | `readText(path)`, `writeText(path, text)` and `mkdir(path)` under `~` (optional) |
| `config` | `load`, `get`, `set` and `onChange` for the applet's settings (optional) |

A service the host lacks is missing from the object, and the applet does without it. A manifest's `needs` lists the services the applet cannot run without; `wants` lists the ones it uses when present. An action module calls `pudlActions.provide(id, handlers)`.

Nothing in a package may reach a host's own globals or a fixed `/api/` address. `tools/pack.js` refuses a package that does.

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

checks each package's manifest and portability and copies the packages, with their shared folders, to `dist/`. A host installs a release by copying `dist/` into `wwwroot/applets/`.

## Licence

Apache License 2.0; see `LICENSE`.
