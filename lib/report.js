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
    constructor(title, subtitle, date, class_, schema, documents)
    {
        this.title = title;
        this.subtitle = subtitle;
        this.date = date;
        this.class_ = class_;
        this.schema = schema;
        this.documents = [];
        this.annotationCount = 0;
        this.types = {};

        // Collect types
        schema.entity_types.forEach(x => {
            types[x.type] = 1;
        });
        if (!'SPAN_DEFAULT' in types) {
            schema.entity_types.push({
                 type: 'SPAN_DEFAULT',
                 bgColor: '#ff2222',
                 borderColor: 'darken'
            });
        }

        documents.forEach(item => {
            let annotations = [];
            item.annotations.forEach(function(anno) {
                ++this.annotationCount;
                const cls = anno.class || null;
                const label = anno.label || null;
                delete anno.cls;
                delete anno.label;

                let newData = {text: item.text};
                for (const key in anno) {
                    newData[key] = anno[key];
                }

                annotations.push({
                    class: cls,
                    label: label,
                    data: newData
                });
            });

            this.documents.push({id: item.id, annotations: annotations});
        });
    }

    static create(data)
    {
        const promise = data.schema == "string" ?
            this.loadJson(data.schema) :
            Promise.resolve(data.schema);
        return promise.then(schema => {
            return new Report(
                data.title ?? "",
                data.subtitle ?? "",
                data.date ?? "",
                data.style ?? "",
                schema,
                data.documents
            );
        }).catch(_ => {
            this.displayError(
                "Schema Not Found",
                "Failed loading schema:<i>" + this.escapeHtml(data.schema) + "</i>"
            );
        });
    }

    static load(path)
    {
        return loadData(path).then(data => {
            return this.create(data);
        }).catch(_ => {
            this.displayError(
                "Report Not Found",
                "Failed loading report:<i>" + this.escapeHtml(path) + "</i>"
            );
        });
    }

    display()
    {
        const content = this.createElement("table", null, {id: "content"});
        const table = this.appendElement(content, "table");
        const row = this.appendElement(table, "tr");
        this.appendElement(row, "th", "Document");
        this.appendElement(row, "th", "Annotation");
        that.documents.forEach((doc, i) => {
            const row = this.appendElement(table, "tr");
            this.appendElement(row, "td", doc.id);
            const td = this.appendElement(row, "td");
            doc.annotations.forEach((anno, j) => {
                const cls = anno.class !== null ?
                    "brat " + anno.class:
                    "brat";
                const div = this.appendElement(td, div, null, {class: cls});
                this.appendElement(div, "span", null, {
                    id: this.makeId(i, j),
                    style: this.makeStyle(this.width)
                });
                if (anno.label !== null) {
                    this.appendElement(div, "span", anno.label, {class: label});
                }
            });
        });
        document.body.setAttribute("class", this.style);
        if (this.title) {
            document.body.appendChild(this.createElement('h1', this.title, {id: "title"}));
        }
        if (this.subtitle) {
            document.body.appendChild(this.createElement('div', this.subtitle, {id: "subtitle"}));
        }
        if (this.date) {
            document.body.appendChild(this.createElement('div', this.date, {id: "date"}));
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
                    const newData = {};
                    for (const key in anno.data) {
                        newData[key] = anno.data[key];
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
                    Util.embed(this.makeId(i, j), this.schema, newData, [], dispatcher);
                });
            });
        });
    }

    makeId(i, j)
    {
        return "A-" + i + "-" + j;
    }

    makeStyle(width)
    {
        return width != null ?
            "width:' + width + 'px;display:inline-block" :
            null;
    }

    loadData(path)
    {
        return path.slice(-5) == "json" ?
            this.loadJson(DATA_DIR + path) :
            this.loadScript(DATA_DIR + path + ".js").then(() => {
                if (data !== undefined) {
                    return data;
                } else {
                    throw new Exception("No data found for ${path}");
                }
            });
    }

    loadStyle(src)
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

    loadScript(src)
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

    loadJson(src)
    {
        return fetch(src).then(response => {
            return response.json();
        }).catch(error => {
            throw new Exception("Failed loading ${src}: ${error}");
        });
    }

    displayError(title, message)
    {
        document.body.appendChild(this.createElement('h1', title, {id: "title"}));
        const p = document.createElement('p', null, {id: "content"});
        p.appendChild(this.parseHtml(message));
        document.body.appendChild(p);
    }

    createElement(name, content, attributes)
    {
        const elt = document.createElement(name);
        if (content) {
            elt.appendChild(document.createTextNode(content));
        }
        if (attributes) {
            for (const a in attributes) {
                if (attributes[a] !== null) {
                    elt.setAttribute(attr, attributes[a]);
                }
            }
        }
        return elt;
    }

    appendElement(parent, name, content, attributes)
    {
        const elt = this.createElement(name, content, attributes);
        parent.appendChild(elt);
        return elt;
    }

    parseHtml(html)
    {
        const t = document.createElement('template');
        t.innerHTML = html.trim();
        return t.content.firstChild;
    }

    escapeHtml(value)
    {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, function(m) { return map[m]; });
    }
}
