var STYLE_DIR = "/style/";
var SCHEMA_DIR = "/schema/";
var DATA_DIR = "/data/";

function Report(title, subtitle, date, style, schema, documents) {
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
            var cls = anno.class || null;
            var label = anno.label || null;
            delete anno.cls;
            delete anno.label;

            var newData = {text: item.text};
            for (var key in anno) {
                newData[key] = anno[key];
            }

            annotations.push({
                class: cls,
                label: label,
                data: newData
            });
        });

        that.documents.push({id: item.id, annotations: annotations});
    });
}

Report.load = function(name, success) {
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
};

Report.prototype.display = function() {
    this.loadStyle();
    var that = this;

    $.getScript(SCHEMA_DIR + this.schema + ".js", function() {
        schema.entity_types.push({
             type   : 'SPAN_DEFAULT',
             bgColor: '#ff2222',
             borderColor: 'darken'
        });
        document.title = that.title;
        $("#title").html(that.title);

        if (that.subtitle) {
            $("#subtitle").html(that.subtitle);
        }

        if (that.date) {
            $("#date").html(that.date);
        }

        var table = $("<table/>");
        table.append($("<tr><th style='width: 200px'>Document</th><th>Annotation</th></tr>"));

        var layout = {};

        that.documents.forEach(function(doc, i) {
            var tr = $("<tr/>")
            tr.append($("<td>" + doc.id + "</td>"));

            var td = $("<td/>");
            layout[doc.id] = {};

            doc.annotations.forEach(function(anno, j) {
                var id = that.makeId(i, j);
                var cls = anno.class !== null ? ' ' + anno.class + '"' : '';
                var label = anno.label !== null ? '<span class="label">' + anno.label + '</span>' : '';

                td.append($('<div class="brat' + cls + '"><span id="' + id + '"/>' + label + '</div>'));

                if (label !== '') {
                    layout[doc.id][anno.label] = id;
                }
            });

            tr.append(td);
            table.append(tr);
        });

        $("#report").append(table);

        that.documents.forEach(function(doc, i) {
            doc.annotations.forEach(function(anno, j) {
                var newData = {};
                for (var key in anno.data) {
                    newData[key] = anno.data[key];
                }

                Util.embed(that.makeId(i, j), schema, newData, []);
            });
        });
    });
};

Report.prototype.loadSchema = function(name, success) {
    $.getScript(SCHEMA_DIR + name + ".js", function() {
        success(schema);
    });
};

Report.prototype.loadStyle = function() {
    if (this.style) {
        $("<link/>", {
           rel: "stylesheet",
           type: "text/css",
           href: STYLE_DIR + this.style + ".css"
        }).appendTo("head");
    }
};

Report.prototype.makeId = function(i, j) {
    return "A-" + i + "-" + j;
};
