const ANI_SCHEMA_DIR = "/schema/";
const ANI_DATA_DIR = "/data/";
const ANI_ERROR_EVENTS = {
    "renderError:noFileSpecified": "No file specified",
    "renderError:annotationFileNotFound": "Annotation file not found",
    "renderError:unableToReadTextFile": "Unable to read text file",
    "renderError:isDirectoryError": "Is directory error",
    "unknownError": "Unknown error"
};
const ANI_ZEBRA_BGCOLORS = ["#cce6ff", "#80bfff"];
const ANI_ZEBRA_FGCOLORS = ["black", "black"];
const ANI_ERROR_BGCOLOR = "#ff2222";
const ANI_PAGE_SIZE = 10;
const ANI_MAX_UNSIZABLE_PAGES = 5;
const ANI_MAX_PAGE_NUMBER_BUTTONS = 20;

function param(name) // See https://bit.ly/3qHCNIO
{
    const url = window.location.search.substring(1);
    const params = url.split('&');
    for (let i = 0; i < params.length; i++) {
        const parts = params[i].split('=');
        if (parts[0] == name) {
            return parts[1];
        }
    }
    return null;
}

class Ani {
    constructor(options)
    {
        this.title = options.title ?? "";
        this.subtitle = options.subtitle ?? "";
        this.date = options.date ?? "";
        this.style = options.style ?? null;
        this.width = options.width ?? null;
        this.id = options.id ??  // See https://bit.ly/3SxnDly
            "ani" + (Math.random() + 1).toString(36).substring(7);
        this.pagination = options.pagination ?? null;
        this.setSchema(options);
    }

    static create(options)
    {
        const promise = typeof options.schema == "string" ?
            Ani.loadJson(ANI_SCHEMA_DIR + options.schema + ".json") :
            Promise.resolve(options.schema);
        return promise.then(schema => {
            options.schema = schema;
            if (options.doc !== undefined) {
                return new AniDocument(options);
            } else if ( options.entries.length > 0 &&
                        options.entries[0].candidates !== undefined ) {
                return new AniCuration(options);
            } else {
                return new AniCorpus(options);
            }
        }, _ => {
            Ani.displayError(
                "Failed Creating Report",
                `Failed loading schema '${Report.escapeHtml(options.schema)}'`,
                root
            );
        });
    }

    static load(path, root)
    {
        root = root ?? document.body;
        return Ani.loadData(path).then(options => {
            options.style = options.style ?? param("style");
            options.width = options.width ?? param("width");
            this.upgrade(options);
            return Ani.create(options, root);
        }, error => {
            Ani.displayError(
                "Report Not Found",
                `Failed loading report '${Ani.escapeHtml(path)}'`,
                root
            );
        });
    }

    setSchema(options)
    {
        this.schema = options.schema ?? null;
        this.labels = null;
        if (this.schema) {
            let hasDefault = false;
            for (const x of this.schema.entity_types) {
                if (x.type == "SPAN_DEFAULT") {
                    hasDefault = true;
                    break;
                }
            }
            if (!hasDefault) {
                this.schema.entity_types.push({
                     type: 'SPAN_DEFAULT',
                     bgColor: ANI_ERROR_BGCOLOR,
                     borderColor: "darken"
                });
            }
        } else {
            this.labels = {};
            this.schema = {entity_types: []};
        }
    }

    setPagination()
    {
        let pgn = this.pagination ?? param('pagination');
        if (typeof(pgn) == "string") {
            if (pgn != "0" && pgn != "1") {
                throw new Error(`Invalid pagination: ${pgn}`);
            }
            pgn = pgn == "1";
        }
        if (typeof(pgn) == "boolean") {
            if (pgn) {
               pgn = {
                    pageSize: ANI_PAGE_SIZE,
                    showSizeChanger:
                        this.size() >
                            ANI_PAGE_SIZE *
                            ANI_MAX_UNSIZABLE_PAGES,
                    pageRange:
                        this.size() >
                            ANI_PAGE_SIZE *
                            ANI_MAX_PAGE_NUMBER_BUTTONS ?
                        2 :
                        null
                };
            } else {
                pgn = null;
            }
        } else if (typeof(pgn) != "object") {
            throw new Error(`Invalid pagination: expected string, boolean, or object; found ${typeof(pgn)}`);
        }
        if (pgn != null && this.entries === undefined) {
            throw new Error(`Pagination not supported for documents`);
        }
        this.pagination = pgn;
    }

    display(root)
    {
        root = root ?? document.body;
        const content = this.displayHeader(root);
        this.setPagination();
        if (this.pagination) {
            const control = Ani.appendElement(content, "div", null, {class: "pagination"});
            this.pagination.dataSource = Array.from(
                { length: this.entries.length },
                (_, index) => index
            );
            this.pagination.callback = (data, info) => {
                const from = info.pageSize * (info.pageNumber - 1);
                const to = from + info.pageSize;
                this.displayTable(content, from, to);
            }
            $(control).pagination(this.pagination);
        } else {
            this.displayTable(content);
        }
    }

    displayHeader(root)
    {
        const content = Ani.createElement("div", null, {class: "ani"});
        if (this.style) {
            this.style.split(/ +/).forEach(x => {
                content.classList.add(x);
            });
        }
        if (this.title) {
            document.title = this.title;
            content.appendChild(Ani.createElement('h1', this.title, {class: "title"}));
        }
        if (this.subtitle) {
            content.appendChild(Ani.createElement('div', this.subtitle, {class: "subtitle"}));
        }
        if (this.date) {
            content.appendChild(Ani.createElement('div', this.date, {class: "date"}));
        }
        root.appendChild(content);
        return content;
    }

    displayTable(content, from, to)
    {
        from = from ?? 0;
        to = to ?? Infinity;
        this.prepare(from, to);
        const table = Ani.createElement("table");
        if (this.width !== null) {
            table.style.width = this.width + "px";
        }
        const thead = Ani.appendElement(table, "thead");
        const row = Ani.appendElement(thead, "tr");
        Ani.appendElement(row, "th", "Document");
        Ani.appendElement(row, "th", "Annotation");
        const tbody = Ani.appendElement(table, "tbody");
        let prevId = null;
        let td = null;
        for (const x of this.items(from, to)) {
            if (x.docid !== prevId) {
                const row = Ani.appendElement(tbody, "tr");
                Ani.appendElement(row, "td", x.docid);
                td = Ani.appendElement(row, "td");
            }
            const cls = x.user !== undefined ?
                (x.user == "*" ? "brat accept" :"brat reject") :
                "brat";
            const div = Ani.appendElement(td, "div", null, {class: cls});
            Ani.appendElement(div, "span", null, {
                id: x.domid,
                style: this.width !== null ?
                    "width:100%;display:inline-block" :
                    null
            });
            if (x.user !== undefined) {
                const label = x.user != "*" ? x.user : "accepted";
                Ani.appendElement(div, "span", label, {class: "label"});
            }
            prevId = x.docid;
        }
        const old = content.lastElementChild;
        if (old && old.localName == "table") {
            content.replaceChild(table, old);
        } else {
            content.appendChild(table);
        }
        this.embed(from, to);
    }

    prepare(from, to)
    {
        // Count documents, augment schema, and build index
        this.docCount = 0;
        this.index = param('dump') !== null ? { } : null;
        for (const x of this.items(from, to)) {
            ++this.docCount;
            if (this.labels) {
                const entity_types = this.schema.entity_types;
                for (const ent of x.doc.entities ?? []) {
                    const label = ent[1];
                    if (this.labels.label === undefined) {
                        entity_types.push({
                            type: label,
                            labels: [label],
                            fgColor: ANI_ZEBRA_FGCOLORS[entity_types.length % 2],
                            bgColor: ANI_ZEBRA_BGCOLORS[entity_types.length % 2],
                            borderColor: "darken"
                        });
                        this.labels.label = 1;
                    }
                }
            }
            if (this.index) {
                this.index[x.docid] = this.index[x.docid] ?? {};
                this.index[x.docid][x.user ?? "*"] = x.domid;
            }
        }
    }

    embed(from, to)
    {
        // Call Util.embed() for each DOM ID
        let error = false;
        return new Promise((resolve, reject) => {
            let count = 0;
            for (const x of this.items(from, to)) {
                const dispatcher = new Dispatcher();
                dispatcher.on('doneRendering', () => {
                    if (!error) {
                        ++count;
                        if (count == this.docCount) {
                            if (param('dump') !== null) {
                                // Log index for use by image generator
                                console.log("index = " + JSON.stringify(this.index));
                            }
                            if (parent != window) {
                                // Let iframe parent adjust iframe height
                                parent.postMessage({
                                    name: "iframe.height",
                                    value: {
                                        id: this.id,
                                        height: document.documentElement.scrollHeight
                                    }
                                }, "*");
                            }
                            resolve();
                        }
                    }
                });
                for (const event in ANI_ERROR_EVENTS) {
                    dispatcher.on(event, () => {
                        error = true;
                        reject(ANI_ERROR_EVENTS[event]);
                    });
                }
                x.doc.text = x.text;
                Util.embed(x.domid, this.schema, x.doc, [], dispatcher);
            }
        });
    }

    static loadData(path)
    {
        return path.slice(-5) == ".json" ?
            this.loadJson(ANI_DATA_DIR + path) :
            this.loadScript(ANI_DATA_DIR + path + ".js").then(() => {
                if (typeof data !== "undefined") {
                    return data;
                } else {
                    throw new Error(`No data found for ${path}`);
                }
            });
    }

    static loadScript(src)
    {
        return new Promise((resolve, reject) => {
            let s;
            s = document.createElement('script');
            s.src = src;
            s.type = "text/javascript";
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }

    static async loadJson(src)
    {
        try {
            const response = await fetch(src);
            return response.json();
        } catch (error) {
            throw new Error(`Failed loading ${src}: ${error.message}`);
        }
    }

    static upgrade(options)
    {
        if (options.documents === undefined) {
            return;
        }
        const entries = [];
        for (const doc of options.documents) {
            const docid = doc.id;
            const text = doc.text;
            let candidates = null;
            for (const anno of doc.annotations) {
                delete anno.class;
                if (anno.label !== undefined) {
                    const label = anno.label;
                    delete anno.label;
                    candidates = candidates ?? [];
                    candidates.push({
                        user: label === "accepted" ? "*" : label,
                        doc: anno
                    });
                } else {
                    entries.push({
                        docid: docid,
                        text: text,
                        doc: anno
                    });
                    break;
                }
            }
            if (candidates !== null) {
                entries.push({
                    docid: docid,
                    text: text,
                    candidates: candidates
                });
            }
        }
        options.entries = entries;
        delete options.documents;
    }

    static createElement(name, content, attributes)
    {
        const elt = document.createElement(name);
        if (content) {
            elt.appendChild(document.createTextNode(content));
        }
        if (attributes) {
            for (const a in attributes) {
                if (attributes[a] !== null) {
                    elt.setAttribute(a, attributes[a]);
                }
            }
        }
        return elt;
    }

    static appendElement(parent, name, content, attributes)
    {
        const elt = Ani.createElement(name, content, attributes);
        parent.appendChild(elt);
        return elt;
    }

    static parseHtml(html)
    {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return [...t.content.childNodes]
    }

    static escapeHtml(value)
    {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return value.replace(/[&<>"']/g, m => { return map[m]; });
    }

    static displayError(title, message, root)
    {
        root.appendChild(Ani.createElement('h1', title, {class: "title"}));
        const p = Ani.createElement('p');
        Ani.parseHtml(message).forEach(x => {p.appendChild(x);});
        root.appendChild(p);
    }
}

class AniDocument extends Ani {
    constructor(options)
    {
        super(options);
        this.docid = "doc";
        this.text = options.doc.text;
        this.content = options.doc;
    }

    *items(from, to)
    {
        if (from == 0 && to > 0) {
            yield {
                docid: this.docid,
                text: this.text,
                domid: this.id,
                doc: this.content.doc
            };
        }
    }

    size()
    {
        return 1;
    }
}

class AniCorpus extends Ani {
    constructor(options)
    {
        super(options);
        this.entries = options.entries;
    }

    *items(from, to)
    {
        to = Math.min(to, this.entries.length);
        for (let i = from; i < to; i++) {
            const entry = this.entries[i];
            yield {
                docid: entry.docid,
                text: entry.text,
                domid: this.id + "-" + i,
                doc: entry.doc
            };
        }
    }

    size()
    {
        return this.entries.length;
    }
}

class AniCuration extends Ani {
    constructor(options)
    {
        super(options);
        this.entries = options.entries;
        this.style = this.style ? this.style + " multidoc" : "multidoc";
    }

    *items(from, to)
    {
        to = Math.min(to, this.entries.length);
        for (let i = from; i < to; i++) {
            const entry = this.entries[i];
            for (let j = 0; j < entry.candidates.length; j++) {
                const cand = entry.candidates[j];
                yield {
                    docid: entry.docid,
                    text: entry.text,
                    user: cand.user,
                    domid: `${this.id}-${i}-${j}`,
                    doc: cand.doc
                };
            }
        }
    }

    size()
    {
        return this.entries.length;
    }
}

class Report extends Ani { }

var WebFont = {load: function() { }};
