/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Hello: the example applet package (README.md). It greets, counts how
   many times it has opened in a file under ~ when the host has a file
   service, and keeps the name it was given as its state. */
(function () {
    'use strict';

    function init(root, opts) {
        var host = window.pudlHost || {};
        var name = opts.state || '';
        root.innerHTML = '<div class="hello">' +
            '<p class="hello-greeting" data-role="greeting"></p>' +
            '<p class="hello-visits" data-role="visits" hidden></p>' +
            '<label class="form-label" for="hello-name">Your name</label>' +
            '<input class="form-input" id="hello-name" data-role="name" />' +
            '<button type="button" class="btn" data-action="wave">Wave</button>' +
            '</div>';
        var greeting = root.querySelector('[data-role="greeting"]'), visits = root.querySelector('[data-role="visits"]');
        var input = root.querySelector('[data-role="name"]');
        input.value = name;
        function greet() { greeting.textContent = 'Hello' + (name ? ', ' + name : '') + '.'; }
        greet();
        input.addEventListener('input', function () { name = input.value; greet(); if (opts.changed) { opts.changed(name); } });
        root.querySelector('[data-action="wave"]').addEventListener('click', function () { greeting.textContent = 'Waving at ' + (name || 'you') + '!'; });

        /* The count lives in ~/.hello/visits.json where there is a file
           service; elsewhere there is no count. */
        if (host.fs) {
            host.fs.readText('~/.hello/visits.json').then(function (text) {
                var n = 0;
                try { n = text ? (JSON.parse(text).visits || 0) : 0; } catch (err) { n = 0; }
                n += 1;
                return host.fs.writeText('~/.hello/visits.json', JSON.stringify({ visits: n })).then(function (err) {
                    visits.textContent = err ? 'The visit could not be counted: ' + err : 'Opened ' + n + (n === 1 ? ' time.' : ' times.');
                    visits.hidden = false;
                });
            }).catch(function () { });
        }

        return {
            state: function () { return name || null; },
            setState: function (s) { name = s || ''; input.value = name; greet(); },
            menus: function () {
                return { titles: [{ label: 'Hello', items: host.identity ? host.identity(root, [host.action(root, '[data-action="wave"]', 'Wave')]) : [] }] };
            },
            destroy: function () { }
        };
    }

    window.pudlApplets.register('hello', { init: init });
})();
