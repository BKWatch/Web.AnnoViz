const STYLE_DIR = "/style/";
const SCHEMA_DIR = "/schema/";
const DATA_DIR = "/data/";
const ERROR_EVENTS = {
    "renderError:noFileSpecified": "No file specified",
    "renderError:annotationFileNotFound": "Annotation file not found",
    "renderError:unableToReadTextFile": "Unable to read text file",
    "renderError:isDirectoryError": "Is directory error",
    "unknownError": "Unknown error"
};
const ERROR_COLOR = "#ff2222";

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

class Report {
    constructor(title, subtitle, date, style, width, schema, documents)
    {
        this.title = title;
        this.subtitle = subtitle;
        this.date = date;
        this.style = style;
        this.width = width;
        this.schema = schema;
        this.documents = [];
        this.annotationCount = 0;
        this.types = {};

        schema.entity_types.forEach(x => {
            this.types[x.type] = 1;
        });
        if (!"SPAN_DEFAULT" in this.types) {
            schema.entity_types.push({
                 type: 'SPAN_DEFAULT',
                 bgColor: ERROR_COLOR,
                 borderColor: "darken"
            });
        }

        documents.forEach(item => {
            let annotations = [];
            item.annotations.forEach(anno => {
                ++this.annotationCount;
                const cls = anno.class || null;
                const label = anno.label || null;
                delete anno.cls;
                delete anno.label;

                let data = {text: item.text};
                for (const key in anno) {
                    data[key] = anno[key];
                }

                annotations.push({
                    class: cls,
                    label: label,
                    data: data
                });
            });

            this.documents.push({id: item.id, annotations: annotations});
        });
    }

    static create(data)
    {
        const promise = typeof data.schema == "string" ?
            Report.loadJson(SCHEMA_DIR + data.schema + ".json") :
            Promise.resolve(data.schema);
        return promise.then(schema => {
            return new Report(
                data.title ?? "",
                data.subtitle ?? "",
                data.date ?? "",
                data.style ?? "",
                data.width ?? param("width"),
                schema,
                data.documents
            );
        }, error => {
            Report.displayError(
                "Failed Creating Report",
                `Failed loading schema '${Report.escapeHtml(data.schema)}': ` +
                    error.message
            );
        });
    }

    static load(path)
    {
        return Report.loadData(path).then(data => {
            return Report.create(data);
        }, error => {
            Report.displayError(
                "Report Not Found",
                `Failed loading report '${Report.escapeHtml(path)}': ${error.message}.`
            );
        });
    }

    display()
    {
        const content = Report.createElement("div", null, {id: "content"});
        const table = Report.appendElement(content, "table");
        if (this.width !== null) {
            table.style.width = this.width + "px";
        }
        const row = Report.appendElement(table, "tr");
        Report.appendElement(row, "th", "Document");
        Report.appendElement(row, "th", "Annotation");
        this.documents.forEach((doc, i) => {
            const row = Report.appendElement(table, "tr");
            Report.appendElement(row, "td", doc.id);
            const td = Report.appendElement(row, "td");
            doc.annotations.forEach((anno, j) => {
                const cls = anno.class !== null ?
                    "brat " + anno.class:
                    "brat";
                const div = Report.appendElement(td, "div", null, {class: cls});
                Report.appendElement(div, "span", null, {
                    id: this.makeId(i, j),
                    style: this.width != null ?
                        "width:100%;display:inline-block" :
                        null
                });
                if (anno.label !== null) {
                    Report.appendElement(div, "span", anno.label, {class: "label"});
                }
            });
        });
        if (this.style) {
            document.body.setAttribute("class", this.style);
        }
        if (this.title) {
            document.body.appendChild(Report.createElement('h1', this.title, {id: "title"}));
        }
        if (this.subtitle) {
            document.body.appendChild(Report.createElement('div', this.subtitle, {id: "subtitle"}));
        }
        if (this.date) {
            document.body.appendChild(Report.createElement('div', this.date, {id: "date"}));
        }
        document.body.appendChild(content);
        this.embed();
    }

    embed()
    {
        let error = false;
        return new Promise((resolve, reject) => {
            let count = 0;
            this.documents.forEach((doc, i) => {
                doc.annotations.forEach((anno, j) => {
                    const data = {};
                    for (const key in anno.data) {
                        data[key] = anno.data[key];
                    }
                    const dispatcher = new Dispatcher();
                    dispatcher.on('doneRendering', () => {
                        if (!error) {
                            ++count;
                            if (count == this.annotationCount) {
                                resolve();
                            }
                        }
                    });
                    for (const event in ERROR_EVENTS) {
                        dispatcher.on(event, () => {
                            error = true;
                            reject(ERROR_EVENTS[event]);
                        });
                    }
                    Util.embed(this.makeId(i, j), this.schema, data, [], dispatcher);
                });
            });
        });
    }

    makeId(i, j)
    {
        return "A-" + i + "-" + j;
    }

    makeStyle()
    {
        return this.width != null ? `width:100%;display:inline-block` : null;
    }

    static loadData(path)
    {
        return path.slice(-5) == ".json" ?
            this.loadJson(DATA_DIR + path) :
            this.loadScript(DATA_DIR + path + ".js").then(() => {
                if (typeof data !== "undefined") {
                    return data;
                } else {
                    throw new Error(`No data found for ${path}`);
                }
            });
    }

    static loadStyle(src)
    {
        return new Promise((resolve, reject) => {
            let s;
            s = document.createElement('link');
            s.ref = "stylesheet";
            s.type = "text/css";
            s.href = src;
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
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

    static displayError(title, message)
    {
        document.body.appendChild(Report.createElement('h1', title, {id: "title"}));
        const p = document.createElement('p', null, {id: "content"});
        Report.parseHtml(message).forEach(x => {p.appendChild(x);});
        document.body.appendChild(p);
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
        const elt = Report.createElement(name, content, attributes);
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
}
