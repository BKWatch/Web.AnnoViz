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

class AniBase {
    constructor(options)
    {
        this.title = options.title ?? "";
        this.subtitle = options.subtitle ?? "";
        this.date = options.date ?? "";
        this.style = options.style ?? null;
        this.width = options.width ?? null;
        this.schema = options.schema ?? null;
        this.domid = "ani" + (Math.random() + 1).toString(36).substring(7); // See https://bit.ly/3SxnDly
    }

    static load(path, root)
    {
        root = root ?? document.body;
        return AniBase.loadData(path).then(options => {
            options.style = options.style ??param("style");
            options.width = options.width ?? sparam("width");
            this.upgrade(options);
            if ("document" in data) {
                return new AniDocument(data);
            } else if (data.entries.length > 0 && "candidates" in data.entries[0]) {
                return new AniCuration(data);
            } else {
                return new AniCorpus(data);
            }
        }, error => {
            throw new AnnotationError(
                "Report Not Found",
                `Failed loading report '${AniBase.escapeHtml(path)}': ${error.message}`
            );
        });
    }

    display(root)
    {
        root = root ?? document.body;
        this.build();
        const content = AniBase.createElement("div", null, {class: "ani"});
        if (this.style) {
            content.classList.add(this.style);
        }
        if (this.title) {
            document.title = this.title;
            content.appendChild(AniBase.createElement('h1', this.title, {class: "title"}));
        }
        if (this.subtitle) {
            content.appendChild(AniBase.createElement('div', this.subtitle, {class: "subtitle"}));
        }
        if (this.date) {
            content.appendChild(AniBase.createElement('div', this.date, {class: "date"}));
        }
        const table = AniBase.appendElement(content, "table");
        if (this.width !== null) {
            table.style.width = this.width + "px";
        }
        const row = AniBase.appendElement(table, "tr");
        AniBase.appendElement(row, "th", "Document");
        AniBase.appendElement(row, "th", "Annotation");
        let prevId = null;
        for (x of this.items()) {
            let td = null;
            if (x.docid !== prevId) {
                const row = AniBase.appendElement(table, "tr");
                AniBase.appendElement(row, "td", x.docid);
                td = AniBase.appendElement(row, "td");
            }
            const cls = x.user !== undefined ?
                (x.user == "*" ? "brat accept" :"brat reject") :
                "brat";
            const div = AniBase.appendElement(td, "div", null, {class: cls});
            AniBase.appendElement(div, "span", null, {
                id: x.domid,
                style: this.width != null ?
                    "width:100%;display:inline-block" :
                    null
            });
            if (x.user !== undefined) {
                const label = x.user != "*" ? x.user : "accepted";
                AniBase.appendElement(div, "span", label, {class: "label"});
            }
            prevId = x.docid;
        }
        root.appendChild(content);
        this.embed();
    }

    build()
    {
        const index = {};
        const labels = {};
        const entity_types = [];
        for (const x of this.items()) {
            index[x.docid][x.user ?? "*"] = x.domid;
            for (const ent of x.doc.entities ?? []) {
                const label = ent[1];
                if (this.schema) {
                    labels[label] = 1;
                } else {
                    entity_types.push({
                        "type": label,
                        "labels": [label],
                        "fgColor": ANI_ZEBRA_FGCOLORS[entity_types.length % 2],
                        "bgColor": ANI_ZEBRA_BGCOLORS[entity_types.length % 2],
                        "borderColor": "darken"
                    });
                }
            }
        }
        if (this.schema === null) {
            this.schema = {entity_types: entity_types};
        } else if (!("SPAN_DEFAULT" in labels)) {
            this.schema.entity_types.push({
                 type: 'SPAN_DEFAULT',
                 bgColor: ANI_ERROR_BGCOLOR,
                 borderColor: "darken"
            });
        }
        this.index = index;
    }

    embed()
    {
        let error = false;
        return new Promise((resolve, reject) => {
            let count = 0;
            for (x of this.items()) {
                const dispatcher = new Dispatcher();
                dispatcher.on('doneRendering', () => {
                    if (!error) {
                        ++count;
                        if (count == this.documentCount()) {
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

    static param(name) // See https://bit.ly/3qHCNIO
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

    static upgrade(options)
    {
        if (!("documents") in options) {
            return;
        }
        entries = [];
        for (const doc of options.documents) {
            const docid = doc.id;
            const text = doc.text;
            let candidates = null;
            for (const anno of doc.annotations) {
                delete anno.class;
                if ("label" in anno) {
                    const label = anno.label;
                    delete anno.label;
                    candidates = candidates ?? [];
                    candidates.append({
                        user: label === "accepted" ? "*" : label,
                        doc: anno
                    });
                } else {
                    entries.append({
                        docid: docid,
                        text: text,
                        doc: anno
                    });
                    break;
                }
            }
            if (candidates.length > 0) {
                entries.append({
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
        const elt = AniBase.createElement(name, content, attributes);
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

    static displayError(root, title, message)
    {
        root.appendChild(AniBase.createElement('h1', title, {id: "title"}));
        const p = AniBase.createElement('p', null, {id: "content"});
        AniBase.parseHtml(message).forEach(x => {p.appendChild(x);});
        document.body.appendChild(p);
    }

    static generateId()
    {
        let result = '';
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        const charactersLength = characters.length;
        let counter = 0;
        while (counter < length) {
          result += characters.charAt(Math.floor(Math.random() * charactersLength));
          counter += 1;
        }
        return result;
    }
}

class AniDocument extends AniBase {
    constructor(options)
    {
        super(options);
        this.docid = "doc";
        this.text = options.text;
        this.doc = options.doc;
    }

    *items()
    {
        yield {docid: this.docid, text: this.text, domid: this.domid, doc: this.doc};
    }
}

class AniCorpus extends AniBase {
    constructor(options)
    {
        super(options);
        this.docid = options.docid;
        this.text = options.text;
        this.doc = options.doc;
    }

    *items()
    {
        return yield {
            docid: this.docid,
            text: this.text,
            domid: this.domid,
            doc: this.doc
        };
    }
}

class AniCorpus extends AniBase {
    constructor(options)
    {
        super(options);
        this.entries = options.entries;
    }

    *items()
    {
        let i = 0;
        for (entry of this.entries) {
            return yield {
                docid: entry.docid,
                text: entry.text,
                domid: this.domid + "-" + i++,
                doc: entry.doc
            };
        }
        return null;
    }
}

class AniCuration extends AniBase {
    constructor(options)
    {
        super(options);
        this.entries = options.entries;
    }

    *items()
    {
        let i = 0;
        for (entry of this.entries) {
            let j = 0;
            for (can of entry.candidates) {
                return yield {
                    docid: entry.docid,
                    text: entry.text,
                    user: can.user,
                    domid: `${this.domid}-${i}-${j++}`,
                    doc: can.doc
                };
            }
            ++i;
        }
        return null;
    }
}

class Report extends AniBase { }
