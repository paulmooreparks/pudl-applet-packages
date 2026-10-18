/* Copyright 2026 Paul Parks. SPDX-License-Identifier: Apache-2.0 */
/* Hello's actions (actions.json), run by the host's action broker without
   the applet's window, in the page or on a server. */
(function () {
    'use strict';
    function greet(input) {
        var name = (input.name || '').trim();
        return { output: { greeting: 'Hello' + (name ? ', ' + name : '') + '.' } };
    }
    window.pudlActions.provide('example.hello', { 'greet@1': greet });
})();
