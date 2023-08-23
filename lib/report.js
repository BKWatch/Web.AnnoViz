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

        document.title = that.title;
        $("#title").html(that.title);

        if (that.subtitle) {
            $("#subtitle").html(that.subtitle);
        }

        if (that.date) {
            $("#date").html(that.date);
        }

        var table = $("<table/>");
        table.append($("<tr><th>Document</th><th>Annotation</th></tr>"));

        var index = {};

        that.documents.forEach(function(doc, i) {
            var tr = $("<tr/>")
            tr.append($("<td>" + doc.id + "</td>"));

            var td = $("<td/>");
            index[doc.id] = {};

            doc.annotations.forEach(function(anno, j) {
                var id = that.makeId(i, j);
                var cls = anno.class !== null ? ' ' + anno.class + '"' : '';
                var label = anno.label !== null ? '<span class="label">' + anno.label + '</span>' : '';
                var width = param('width');
                var style = width != null ?
                    'style="width:' + width + 'px;display:inline-block" ' :
                    '';
                td.append($('<div class="brat' + cls + '"><span ' + style + 'id="' + id + '"/>' + label + '</div>'));

                index[doc.id][anno.label || "accepted"] = id;
            });

            tr.append(td);
            table.append(tr);
        });

        $("#report").append(table);
        that.embed(schema, index)
    }

    embed(schema, index)
    {
        let error = false;
        return new Promise((resolve, reject) => {
            let count = 0;
            //const that = this;
            this.documents.forEach((doc, i) => {
                doc.annotations.forEach(function(anno, j) {
                    const newData = {};
                    for (const key in anno.data) {
                        newData[key] = anno.data[key];
                    }
                    const dispatcher = new Dispatcher();
                    dispatcher.on('doneRendering', () => {
                        if (!error) {
                            ++count;
                            if (count == this.annotationCount) {
                                if (param('dump') !== null) {
                                    alert(JSON.stringify(index));
                                }
                                resolve(null);
                            }
                        }
                    });
                    for (const event in ERROR_EVENTS) {
                        dispatcher.on(event, () => {
                            error = true;
                            reject(ERROR_EVENTS[event]);
                        });
                    }
                    Util.embed(this.makeId(i, j), schema, newData, [], dispatcher);
                });
            });
        });
    }

    makeId(i, j) {
        return "A-" + i + "-" + j;
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
        const h = document.createElement('h1');
        h.setAttribute("id", "title");
        h.appendChild(document.createTextNode(title));
        document.body.appendChild(h);
        const p = document.createElement('h');
        h.setAttribute("id", "content");
        const t = document.createElement('template');
        t.innerHTML = message;
        p.appendChild(t.content.firstChild);
        document.body.appendChild(p);
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
