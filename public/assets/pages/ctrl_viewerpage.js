import { createElement, createRender } from "../lib/skeleton/index.js";
import rxjs, { effect } from "../lib/rx.js";
import { ApplicationError } from "../lib/error.js";
import { basename } from "../lib/path.js";
import assert from "../lib/assert.js";
import { get as getConfig } from "../model/config.js";
import { loadCSS } from "../helpers/loader.js";
import WithShell, { init as initShell } from "../components/decorator_shell_filemanager.js";
import { init as initMenubar } from "./viewerpage/component_menubar.js";
import { init as initCache } from "./filespage/cache.js";

import ctrlError from "./ctrl_error.js";
import { getFilename, getDownloadUrl, getCurrentPath } from "./viewerpage/common.js";
import { opener } from "./viewerpage/mimetype.js";
import { options } from "./viewerpage/model_files.js";

import "../components/breadcrumb.js";

function loadModule(appName) {
    switch (appName) {
    case "editor":
        return import("./viewerpage/application_editor.js");
    case "pdf":
        return import("./viewerpage/application_pdf.js");
    case "image":
        return import("./viewerpage/application_image.js");
    case "download":
        return import("./viewerpage/application_downloader.js");
    case "form":
        return import("./viewerpage/application_form.js");
    case "audio":
        return import("./viewerpage/application_audio.js");
    case "video":
        return import("./viewerpage/application_video.js");
    case "ebook":
        return import("./viewerpage/application_ebook.js");
    case "3d":
        return import("./viewerpage/application_3d.js");
    case "appframe":
        return import("./viewerpage/application_iframe.js");
    case "map":
        return import("./viewerpage/application_map.js");
    case "url":
        return import("./viewerpage/application_url.js");
    case "table":
        return import("./viewerpage/application_table.js");
    case "skeleton":
        return import("./viewerpage/application_skeleton.js");
    default:
        throw new ApplicationError("Internal Error", `Unknown opener app "${appName}" at "${getCurrentPath()}"`);
    }
};
const loadModuleWithMemory = (function() {
    const memory = {};
    return function(appName) {
        if (memory[appName]) return Promise.resolve(memory[appName]);
        return loadModule(appName).then((module) => {
            memory[appName] = module;
            return module;
        });
    };
})();

export default WithShell(async function(render) {
    const $page = createElement(`<div class="component_page_viewerpage"></div>`);
    render($page);

    // feature: render viewer application
    effect(rxjs.of(getConfig("mime", {})).pipe(
        rxjs.map((mimes) => opener(basename(getCurrentPath()), mimes)),
        rxjs.mergeMap(([opener, opts]) => rxjs.from(loadModuleWithMemory(opener)).pipe(rxjs.switchMap(async(module) => {
            module.default(createRender($page), { ...opts, acl$: options(), getFilename, getDownloadUrl });
        }))),
        rxjs.catchError(ctrlError()),
    ));

    // feature: cleanup up the design when navbar is not there
    effect(rxjs.of(new URL(location.toString()).searchParams.get("nav")).pipe(
        rxjs.filter((value) => value === "false"),
        rxjs.tap(() => {
            const $parent = assert.truthy($page.parentElement);
            $parent.style.border = "none";
            $parent.style.borderRadius = "0";
        }),
    ));
});

export async function init() {
    return Promise.all([
        loadCSS(import.meta.url, "./ctrl_viewerpage.css"),
        initShell(), initMenubar(), initCache(),
        rxjs.of(getConfig("mime", {})).pipe(
            rxjs.map((mimes) => opener(basename(getCurrentPath()), mimes)),
            rxjs.mergeMap(([opener]) => loadModule(opener)),
            rxjs.mergeMap((module) => typeof module.init === "function"? module.init() : rxjs.EMPTY),
            rxjs.catchError(() => rxjs.EMPTY),
        ).toPromise(),
    ]);
}
