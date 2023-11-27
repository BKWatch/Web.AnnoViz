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
        this.domid = "ani" + (Math.random() + 1).toString(36).substring(7); // See https://bit.ly/3SxnDly
        this.setSchema(options)
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
        }, error => {
            Ani.displayError(
                "Failed Creating Report",
                `Failed loading schema '${Report.escapeHtml(data.schema)}'`,
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

    display(root, from, to)
    {
        from = from ?? 0;
        to = to ?? Infinity;
        root = root ?? document.body;
        this.prepare(from, to);
        const content = Ani.createElement("div", null, {class: "ani"});
        if (this.style) {
            content.classList.add(this.style);
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
        const table = Ani.appendElement(content, "table");
        if (this.width !== null) {
            table.style.width = this.width + "px";
        }
        const row = Ani.appendElement(table, "tr");
        Ani.appendElement(row, "th", "Document");
        Ani.appendElement(row, "th", "Annotation");
        let prevId = null;
        let td = null;
        for (const x of this.items(from, to)) {
            if (x.docid !== prevId) {
                const row = Ani.appendElement(table, "tr");
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
        root.appendChild(content);
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
                            "type": label,
                            "labels": [label],
                            "fgColor": ANI_ZEBRA_FGCOLORS[entity_types.length % 2],
                            "bgColor": ANI_ZEBRA_BGCOLORS[entity_types.length % 2],
                            "borderColor": "darken"
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
                                console.log("index = " + JSON.stringify(this.index));
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
        this.text = options.text;
        this.doc = options.doc;
    }

    *items(from, to)
    {
        if (from == 0 && to > 0) {
            yield {
                docid: this.docid,
                text: this.text,
                domid: this.domid,
                doc: this.doc
            };
        }
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
                domid: this.domid + "-" + i,
                doc: entry.doc
            };
        }
    }
}

class AniCuration extends Ani {
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
            for (let j = 0; j < entry.candidates.length; j++) {
                const cand = entry.candidates[j];
                yield {
                    docid: entry.docid,
                    text: entry.text,
                    user: cand.user,
                    domid: `${this.domid}-${i}-${j}`,
                    doc: cand.doc
                };
            }
        }
    }
}

class Report extends Ani { }

var WebFont = {load: function() { }};
