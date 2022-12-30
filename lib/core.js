
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
        this.schema = this.loadSchema(schema);
        this.documents = [];
        documents.forEach(function(item) {
            let annotations = [];
            item.annotations.forEach(function(anno) {
                let tags = anno.tags || [];
                delete anno.tags;
                annotations.push([tags, this.schema, {text: item.text, ...anno}]);
            });
            documents.push({id: item.id, annotations: annotations});
        });
    }

    static load(name)
    {
        $.getScript(DATA_DIR + name + ".js");
        return new Report(data.title, data.substitle, data.date, data.style, data.schema, data.documents);
    }

    display()
    {
        this.loadStyle();
        document.title = this.title;
        $("#title").html(this.title);
        $("#subtitle").html(this.subtitle);
        $("#date").html(this.date);
        var table = $("<table/>");
        table.append($("<tr><th>Document</th><th>Annotation</th></tr>"));
        this.documents.forEach(function(doc, i) {
            let row = $("<tr/>")
            row.append($("<td>" + doc.id + "</td>"));
            let td = $("<td/>");
            doc.annotations.forEach(function(anno, j) {
                let id = this.makeId(i, j);
                td.append($('<div class="' + anno.tags + '"><span id="' + id + '"/></div>'));
            });
            tr.append(td);
            table.append(tr);
        });
        $("#report").append(table);
        this.documents.forEach(function(doc, i) {
            doc.annotations.forEach(function(anno, j) {
                Util.embed(this.makeId(i, j), {...this.schema}, {...anno}, []);
            });
        });
    }

    loadSchema(name)
    {
        $.getScript(SCHEMA_DIR + schema + ".js");
        return schema;
    }

    loadStyle()
    {
        $("<link/>", {
           rel: "stylesheet",
           type: "text/css",
           href: STYLE_DIR + this.name + ".css"
        }).appendTo("head");
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
