
const STYLE_DIR = "/style/"
const SCHEMA_DIR = "/schema/"
const DATA_DIR = "/data/"

class Report {
    constructor(title, subtitle, date, style, schema, documents)
    {
        this.title = title;
        this.subtitle = subtitle;
        this.date = date;
        this.style = style;
        this.schema = schema;
        this.documents = [];
        var that = this;
        documents.forEach(function(item) {
            var annotations = [];
            item.annotations.forEach(function(anno) {
                let cls = anno.class || null;
                let label = anno.label || null;
                delete anno.cls;
                delete anno.label;
                annotations.push({
                    class: cls,
                    label: label,
                    data: {text: item.text, ...anno}
                });
            });
            that.documents.push({id: item.id, annotations: annotations});
        });
    }

    static load(name, success)
    {
        $.getScript(DATA_DIR + name + ".js", function() {
            if (success) {
                success(new Report(
                    data.title,
                    data.subtitle,
                    data.date,
                    data.style,
                    data.schema,
                    data.documents
                ));
            }
        });
    }

    display()
    {
        this.loadStyle();
        var that = this;
        $.getScript(SCHEMA_DIR + this.schema + ".js", function() {
            document.title = that.title;
            $("#title").html(that.title);
            if (that.subtitle) {
                $("#subtitle").html(that.subtitle);
            }
            if (that.date) {
                $("#date").html(that.date);
            }
            let table = $("<table/>");
            table.append($("<tr><th>Document</th><th>Annotation</th></tr>"));
            that.documents.forEach(function(doc, i) {
                let tr = $("<tr/>")
                tr.append($("<td>" + doc.id + "</td>"));
                let td = $("<td/>");
                doc.annotations.forEach(function(anno, j) {
                    let id = that.makeId(i, j);
                    let cls = anno.class !== null ? ' class="' + anno.class + '"' : '';
                    let label = anno.label !== null ?
                        '<div class="label">' + anno.label + '</div>' :
                        '';
                    td.append($('<div' + cls + '><div class="brat" id="' + id + '">' + label + '</div></div>'));
                });
                tr.append(td);
                table.append(tr);
            });
            $("#report").append(table);
            that.documents.forEach(function(doc, i) {
                doc.annotations.forEach(function(anno, j) {
                    Util.embed(that.makeId(i, j), {...schema}, {...anno.data}, []);
                });
            });
        });
    }

    loadSchema(name, success)
    {
        $.getScript(SCHEMA_DIR + name + ".js", function() {
            success(schema);
        });
    }

    loadStyle()
    {
        if (this.style) {
            $("<link/>", {
               rel: "stylesheet",
               type: "text/css",
               href: STYLE_DIR + this.style + ".css"
            }).appendTo("head");
        }
    }

    makeId(i, j)
    {
        return "A-" + i + "-" + j;
    }

    title;
    subtitle;
    date;
    style;
    schema;
    documents;
}
